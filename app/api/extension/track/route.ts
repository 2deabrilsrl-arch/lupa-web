import { supabaseAdmin } from '@/lib/supabase'
import { corsPreflight, corsResponse } from '@/lib/cors'

export const runtime = 'nodejs'

interface TrackPayload {
  ml_item_id: string
  title?: string
  thumbnail_url?: string
  permalink?: string
  category_id?: string
  category_name?: string
  seller_id?: number
  seller_nickname?: string
  condition?: string
  site_id?: string
  price: number
  original_price?: number | null
  currency?: string
  discount_percent?: number | null
  price_type?: 'standard' | 'promotion'
}

export async function OPTIONS() {
  return corsPreflight()
}

export async function POST(request: Request) {
  let payload: TrackPayload
  try {
    payload = await request.json()
  } catch {
    return corsResponse({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!payload?.ml_item_id || typeof payload.price !== 'number' || payload.price <= 0) {
    return corsResponse({ error: 'Missing or invalid ml_item_id / price' }, { status: 400 })
  }

  // Upsert item by ml_item_id
  const { data: item, error: itemErr } = await supabaseAdmin
    .from('items')
    .upsert(
      {
        ml_item_id: payload.ml_item_id,
        title: payload.title ?? '(sin título)',
        thumbnail_url: payload.thumbnail_url ?? null,
        permalink: payload.permalink ?? null,
        category_id: payload.category_id ?? null,
        category_name: payload.category_name ?? null,
        seller_id: payload.seller_id ?? null,
        seller_nickname: payload.seller_nickname ?? null,
        condition: payload.condition ?? null,
        site_id: payload.site_id ?? 'MLA',
        last_seen_at: new Date().toISOString(),
        is_active: true
      },
      { onConflict: 'ml_item_id' }
    )
    .select('id')
    .single()

  if (itemErr || !item) {
    console.error('[Track] Item upsert failed', itemErr)
    return corsResponse({ error: 'Failed to save item' }, { status: 500 })
  }

  // Compute discount if not provided
  let discount = payload.discount_percent ?? null
  if (discount == null && payload.original_price && payload.original_price > payload.price) {
    discount = Math.round(((payload.original_price - payload.price) / payload.original_price) * 100)
  }

  const { error: priceErr } = await supabaseAdmin.rpc('insert_price_if_changed', {
    p_item_id: item.id,
    p_price: payload.price,
    p_original_price: payload.original_price ?? null,
    p_currency: payload.currency ?? 'ARS',
    p_discount_percent: discount,
    p_price_type: payload.price_type ?? (payload.original_price ? 'promotion' : 'standard'),
    p_source: 'extension'
  })

  if (priceErr) {
    console.error('[Track] Price insert failed', priceErr)
    return corsResponse({ error: 'Failed to save price' }, { status: 500 })
  }

  return corsResponse({ ok: true, item_id: item.id })
}
