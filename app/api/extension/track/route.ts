import { supabaseAdmin } from '@/lib/supabase'
import { corsPreflight, corsResponse } from '@/lib/cors'
import {
  cleanTitle,
  currencyForSite,
  hasPriceSuffix,
  MAX_ACCEPTABLE_PRICE,
  MAX_PRICE_DEVIATION_FACTOR
} from '@/lib/ml-text'

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

/** IDs que la API pública de ML no resuelve, pero que la extensión sí puede trackear. */
const ML_ID_RE = /^(MLA|MLB|MLM|MLC|MCO|MLU|MPE|MEC|MPY|MBO|MRD)U?\d{6,}$/i

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

  if (!payload?.ml_item_id || !ML_ID_RE.test(payload.ml_item_id)) {
    return corsResponse({ error: 'Invalid ml_item_id' }, { status: 400 })
  }

  const price = Number(payload.price)
  if (!Number.isFinite(price) || price <= 0 || price > MAX_ACCEPTABLE_PRICE) {
    return corsResponse({ error: 'Invalid price' }, { status: 400 })
  }

  const siteId = payload.site_id ?? payload.ml_item_id.slice(0, 3).toUpperCase()
  // Nunca asumir ARS: si el cliente no manda moneda, la derivamos del sitio.
  const currency = payload.currency ?? currencyForSite(siteId)
  const incomingTitle = cleanTitle(payload.title)

  // ¿Ya lo conocíamos?
  const { data: existing } = await supabaseAdmin
    .from('items')
    .select('id, title')
    .eq('ml_item_id', payload.ml_item_id)
    .maybeSingle<{ id: number; title: string | null }>()

  // Guarda contra precios mal parseados: si el nuevo precio se desvía más de
  // 10x (para arriba o para abajo) de la última captura en la misma moneda, no
  // lo guardamos. Es lo que dejó entrar valores como 104,37 en un producto de
  // $104.368 y precios de 9.451 millones de pesos.
  if (existing) {
    const { data: last } = await supabaseAdmin
      .from('price_history')
      .select('price')
      .eq('item_id', existing.id)
      .eq('currency', currency)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ price: number }>()

    if (last) {
      const lastPrice = Number(last.price)
      if (lastPrice > 0) {
        const ratio = price / lastPrice
        if (ratio > MAX_PRICE_DEVIATION_FACTOR || ratio < 1 / MAX_PRICE_DEVIATION_FACTOR) {
          console.warn(
            `[Track] Precio rechazado por desvío: ${payload.ml_item_id} ${currency} ${price} vs último ${lastPrice}`
          )
          return corsResponse(
            { ok: false, rejected: 'price_deviation', item_id: existing.id },
            { status: 202 }
          )
        }
      }
    }
  }

  // El título de la extensión sale del DOM y puede venir peor que el que ya
  // tenemos guardado desde la API de ML. Sólo lo pisamos si el guardado está
  // vacío, es el placeholder, o todavía arrastra el precio pegado.
  const keepStoredTitle =
    !!existing?.title &&
    existing.title !== '(sin título)' &&
    !hasPriceSuffix(existing.title)

  const itemPatch: Record<string, unknown> = {
    ml_item_id: payload.ml_item_id,
    thumbnail_url: payload.thumbnail_url ?? null,
    permalink: payload.permalink ?? null,
    category_id: payload.category_id ?? null,
    category_name: payload.category_name ?? null,
    seller_id: payload.seller_id ?? null,
    seller_nickname: payload.seller_nickname ?? null,
    condition: payload.condition ?? null,
    site_id: siteId,
    last_seen_at: new Date().toISOString(),
    fetch_failures: 0,
    is_active: true
  }
  if (!keepStoredTitle) {
    itemPatch.title = incomingTitle || existing?.title || '(sin título)'
  }

  const { data: item, error: itemErr } = await supabaseAdmin
    .from('items')
    .upsert(itemPatch, { onConflict: 'ml_item_id' })
    .select('id')
    .single()

  if (itemErr || !item) {
    console.error('[Track] Item upsert failed', itemErr)
    return corsResponse({ error: 'Failed to save item' }, { status: 500 })
  }

  const originalPrice =
    payload.original_price != null && Number.isFinite(Number(payload.original_price))
      ? Number(payload.original_price)
      : null

  let discount = payload.discount_percent ?? null
  if (discount == null && originalPrice && originalPrice > price) {
    discount = Math.round(((originalPrice - price) / originalPrice) * 100)
  }

  const { error: priceErr } = await supabaseAdmin.rpc('insert_price_if_changed', {
    p_item_id: item.id,
    p_price: price,
    p_original_price: originalPrice,
    p_currency: currency,
    p_discount_percent: discount,
    p_price_type: payload.price_type ?? (originalPrice ? 'promotion' : 'standard'),
    p_source: 'extension'
  })

  if (priceErr) {
    console.error('[Track] Price insert failed', priceErr)
    return corsResponse({ error: 'Failed to save price' }, { status: 500 })
  }

  return corsResponse({ ok: true, item_id: item.id })
}
