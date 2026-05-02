import { supabaseAdmin } from '@/lib/supabase'
import { corsPreflight, corsResponse } from '@/lib/cors'

export const runtime = 'nodejs'

interface PriceRow {
  price: number
  original_price: number | null
  discount_percent: number | null
  price_type: string | null
  captured_at: string
}

export async function OPTIONS() {
  return corsPreflight()
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mlItemId = searchParams.get('ml_item_id')
  const daysParam = searchParams.get('days')
  const days = daysParam ? Math.min(Math.max(parseInt(daysParam, 10) || 90, 1), 365) : 90

  if (!mlItemId) {
    return corsResponse({ error: 'Missing ml_item_id' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.rpc('get_price_history', {
    p_ml_item_id: mlItemId,
    p_days: days
  })

  if (error) {
    console.error('[History] RPC failed', error)
    return corsResponse({ error: 'Failed to fetch history' }, { status: 500 })
  }

  const history = (data ?? []) as PriceRow[]

  if (history.length === 0) {
    return corsResponse({
      ml_item_id: mlItemId,
      days,
      history: [],
      stats: null
    })
  }

  const prices = history.map(h => Number(h.price))
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
  const latest = history[0]

  // Fake-discount detection: was the price recently lower than its claimed "original"?
  let fakeDiscountDetected = false
  let fakeDiscountReason: string | null = null
  if (latest.original_price && latest.original_price > latest.price) {
    const last30 = history.filter(h => {
      const d = new Date(h.captured_at).getTime()
      return Date.now() - d < 30 * 24 * 60 * 60 * 1000
    })
    if (last30.length > 1) {
      const minLast30 = Math.min(...last30.map(h => Number(h.price)))
      if (minLast30 < latest.original_price * 0.95) {
        fakeDiscountDetected = true
        fakeDiscountReason =
          `El precio ya estuvo en $${Math.round(minLast30).toLocaleString('es-AR')} ` +
          `en los últimos 30 días — el "precio anterior" de $${Math.round(latest.original_price).toLocaleString('es-AR')} parece inflado.`
      }
    }
  }

  return corsResponse({
    ml_item_id: mlItemId,
    days,
    stats: {
      min,
      max,
      avg,
      count: history.length,
      latest_price: Number(latest.price),
      latest_at: latest.captured_at,
      currency: 'ARS'
    },
    fake_discount: {
      detected: fakeDiscountDetected,
      reason: fakeDiscountReason
    },
    history: history.map(h => ({
      price: Number(h.price),
      original_price: h.original_price ? Number(h.original_price) : null,
      discount_percent: h.discount_percent ? Number(h.discount_percent) : null,
      captured_at: h.captured_at
    }))
  })
}
