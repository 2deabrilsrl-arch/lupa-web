import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Vercel Cron: runs every 6 hours (configured in vercel.json)
// Updates prices of all tracked items via ML public API

export const maxDuration = 300 // 5 min max for Pro plan

export async function GET(request: Request) {
  // Verify cron secret (Vercel sends this header)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 1. Get all active tracked items
    const { data: items, error } = await supabaseAdmin
      .from('items')
      .select('id, ml_item_id, site_id')
      .eq('is_active', true)
      .order('last_seen_at', { ascending: false })
      .limit(200) // Process 200 items per run

    if (error) throw error
    if (!items || items.length === 0) {
      return NextResponse.json({ message: 'No items to update', updated: 0 })
    }

    let updated = 0
    let errors = 0

    // 2. Fetch current price for each item from ML API
    for (const item of items) {
      try {
        const res = await fetch(
          `https://api.mercadolibre.com/items/${item.ml_item_id}?attributes=price,original_price,currency_id,sale_price`,
          { headers: { 'Accept': 'application/json' } }
        )

        if (!res.ok) {
          console.log(`[Cron] ML API error for ${item.ml_item_id}: ${res.status}`)
          errors++
          continue
        }

        const mlData = await res.json()
        const price = mlData.sale_price?.amount || mlData.price || 0
        const originalPrice = mlData.original_price || null
        const currency = mlData.currency_id || 'ARS'

        if (price === 0) continue

        // Calculate discount
        let discountPercent = null
        if (originalPrice && originalPrice > price) {
          discountPercent = Math.round(((originalPrice - price) / originalPrice) * 100)
        }

        // 3. Insert price using deduplication function
        await supabaseAdmin.rpc('insert_price_if_changed', {
          p_item_id: item.id,
          p_price: price,
          p_original_price: originalPrice,
          p_currency: currency,
          p_discount_percent: discountPercent,
          p_price_type: originalPrice ? 'promotion' : 'standard',
          p_source: 'cron'
        })

        // Update last_seen_at
        await supabaseAdmin
          .from('items')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', item.id)

        updated++

        // Rate limit: ML allows ~30 req/min for public endpoints
        await new Promise(r => setTimeout(r, 2500))

      } catch (err) {
        console.error(`[Cron] Error processing ${item.ml_item_id}:`, err)
        errors++
      }
    }

    return NextResponse.json({
      message: 'Cron completed',
      total: items.length,
      updated,
      errors,
      timestamp: new Date().toISOString()
    })

  } catch (err) {
    console.error('[Cron] Fatal error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
