/**
 * Normalize fetching ML data — accepts either an item ID (/items/{id}) or a
 * catalog product ID (/products/{id}) and returns a unified shape we can
 * store in our `items` table.
 */
import { mlFetch } from './ml-service'

export interface NormalizedMlInfo {
  ml_id: string
  source: 'item' | 'product'
  title: string
  thumbnail_url: string | null
  permalink: string | null
  category_id: string | null
  seller_id: number | null
  site_id: string
  /** null when the catalog product has no active sellers right now */
  price: number | null
  original_price: number | null
  currency: string
  /** ML shipping flags — used by Deal Score */
  free_shipping: boolean
  shipping_mode: string | null
  /** ML condition: new | used | not_specified */
  condition: string | null
}

interface ItemResp {
  id: string
  title: string
  thumbnail: string | null
  permalink: string | null
  site_id: string
  seller_id: number | null
  category_id: string | null
  condition: string | null
  price: number | null
  original_price: number | null
  sale_price: { amount: number } | null
  currency_id: string | null
  shipping: { free_shipping?: boolean; mode?: string } | null
}

interface ProductResp {
  id: string
  name: string
  permalink: string | null
  site_id: string
  category_id: string | null
  pictures: Array<{ url: string }> | null
  buy_box_winner: {
    price: number | null
    original_price: number | null
    currency_id: string | null
    seller_id: number | null
  } | null
}

export async function fetchMlInfo(mlId: string): Promise<NormalizedMlInfo | null> {
  // 1. Try as a listing (item)
  const itemRes = await mlFetch(`/items/${mlId}`)
  if (itemRes.ok) {
    const data = (await itemRes.json()) as ItemResp
    const price = data.sale_price?.amount ?? data.price ?? null
    return {
      ml_id: data.id,
      source: 'item',
      title: data.title ?? '(sin título)',
      thumbnail_url: data.thumbnail ?? null,
      permalink: data.permalink ?? null,
      category_id: data.category_id ?? null,
      seller_id: data.seller_id ?? null,
      site_id: data.site_id ?? mlId.slice(0, 3),
      price,
      original_price: data.original_price ?? null,
      currency: data.currency_id ?? 'ARS',
      free_shipping: data.shipping?.free_shipping ?? false,
      shipping_mode: data.shipping?.mode ?? null,
      condition: data.condition ?? null
    }
  }

  // 2. Fall back to catalog product
  const prodRes = await mlFetch(`/products/${mlId}`)
  if (prodRes.ok) {
    const data = (await prodRes.json()) as ProductResp
    const winner = data.buy_box_winner

    // 2a. If buy_box_winner is null (common — ML restricts buy_box for many catalogs),
    // fall back to /products/{id}/items to get the actual sellers' listings.
    let price = winner?.price ?? null
    let originalPrice = winner?.original_price ?? null
    let currency = winner?.currency_id ?? 'ARS'
    let sellerId = winner?.seller_id ?? null

    if (price == null) {
      const cheapest = await fetchCheapestListing(mlId)
      if (cheapest) {
        price = cheapest.price
        originalPrice = cheapest.original_price
        currency = cheapest.currency
        sellerId = cheapest.seller_id
      }
    }

    return {
      ml_id: data.id,
      source: 'product',
      title: data.name ?? '(sin título)',
      thumbnail_url: data.pictures?.[0]?.url ?? null,
      permalink: data.permalink ?? null,
      category_id: data.category_id ?? null,
      seller_id: sellerId,
      site_id: data.site_id ?? mlId.slice(0, 3),
      price,
      original_price: originalPrice,
      currency,
      free_shipping: false,
      shipping_mode: null,
      condition: null
    }
  }

  return null
}

interface ProductItemListing {
  item_id: string
  seller_id: number
  price: number
  original_price: number | null
  currency_id: string
  condition: string
}

/**
 * For catalog products with no buy_box_winner, query the listings under that
 * catalog and return the cheapest "new" one. Anchors price tracking to a real
 * sellable price even when ML hides buy_box from the API.
 */
async function fetchCheapestListing(catalogId: string): Promise<{
  price: number
  original_price: number | null
  currency: string
  seller_id: number
} | null> {
  try {
    const res = await mlFetch(`/products/${catalogId}/items?limit=10`)
    if (!res.ok) return null
    const data = (await res.json()) as { results?: ProductItemListing[] }
    const items = (data.results ?? [])
      .filter(i => i.price && i.price > 0 && i.condition === 'new')
      .sort((a, b) => a.price - b.price)
    if (items.length === 0) return null
    const cheapest = items[0]
    return {
      price: cheapest.price,
      original_price: cheapest.original_price,
      currency: cheapest.currency_id ?? 'ARS',
      seller_id: cheapest.seller_id
    }
  } catch {
    return null
  }
}

/**
 * Fetch seller reputation. Returns null if not available or fetch fails.
 * Cached at the caller level (we just call it once per item).
 */
export interface SellerInfo {
  id: number
  nickname: string | null
  reputation_level: string | null  // e.g. "5_green", "4_light_green", null
  power_seller_status: string | null  // "platinum" | "gold" | "silver" | null
  transactions_completed: number | null
  transactions_canceled: number | null
}

interface UserResp {
  id: number
  nickname: string | null
  seller_reputation: {
    level_id: string | null
    power_seller_status: string | null
    transactions: {
      completed: number | null
      canceled: number | null
    } | null
  } | null
}

export async function fetchSellerInfo(sellerId: number): Promise<SellerInfo | null> {
  try {
    const res = await mlFetch(`/users/${sellerId}`)
    if (!res.ok) return null
    const data = (await res.json()) as UserResp
    const rep = data.seller_reputation
    return {
      id: data.id,
      nickname: data.nickname ?? null,
      reputation_level: rep?.level_id ?? null,
      power_seller_status: rep?.power_seller_status ?? null,
      transactions_completed: rep?.transactions?.completed ?? null,
      transactions_canceled: rep?.transactions?.canceled ?? null
    }
  } catch {
    return null
  }
}
