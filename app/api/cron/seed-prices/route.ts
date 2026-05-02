import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { processAlertsForItem } from '@/lib/alerts'
import { fetchMlInfo } from '@/lib/ml-fetch'

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

    // 2. Fetch current price for each item from ML API (authenticated, item OR catalog product)
    for (const item of items) {
      try {
        const mlData = await fetchMlInfo(item.ml_item_id)

        if (!mlData) {
          console.log(`[Cron] ML fetch failed for ${item.ml_item_id}`)
          errors++
          continue
        }

        const price = mlData.price
        const originalPrice = mlData.original_price
        const currency = mlData.currency

        if (!price || price === 0) continue

        // Calculate discount
        let discountPercent = null
        if (originalPrice && originalPrice > price) {
          discountPercent = Math.round(((originalPrice - price) / originalPrice) * 100)
        }

        // Get previous price for alert evaluation
        const { data: prevRow } = await supabaseAdmin
          .from('price_history')
          .select('price')
          .eq('item_id', item.id)
          .order('captured_at', { ascending: false })
          .limit(1)
          .maybeSingle<{ price: number }>()
        const previousPrice = prevRow ? Number(prevRow.price) : null

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

        // Always evaluate alerts for this item (24h cooldown prevents email spam).
        // Newly-created alerts pick up on the next cron run even if price didn't change.
        processAlertsForItem(item.id, price, previousPrice).catch(err =>
          console.error('[Cron] Alert processing failed for item', item.id, err)
        )

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
