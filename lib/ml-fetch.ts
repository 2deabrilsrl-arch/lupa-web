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
  price: number
  original_price: number | null
  currency: string
}

interface ItemResp {
  id: string
  title: string
  thumbnail: string | null
  permalink: string | null
  site_id: string
  seller_id: number | null
  category_id: string | null
  price: number | null
  original_price: number | null
  sale_price: { amount: number } | null
  currency_id: string | null
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
    const price = data.sale_price?.amount ?? data.price ?? 0
    if (!price) return null
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
      currency: data.currency_id ?? 'ARS'
    }
  }

  // 2. Fall back to catalog product
  const prodRes = await mlFetch(`/products/${mlId}`)
  if (prodRes.ok) {
    const data = (await prodRes.json()) as ProductResp
    const winner = data.buy_box_winner
    if (!winner?.price) return null
    return {
      ml_id: data.id,
      source: 'product',
      title: data.name ?? '(sin título)',
      thumbnail_url: data.pictures?.[0]?.url ?? null,
      permalink: data.permalink ?? null,
      category_id: data.category_id ?? null,
      seller_id: winner.seller_id ?? null,
      site_id: data.site_id ?? mlId.slice(0, 3),
      price: winner.price,
      original_price: winner.original_price ?? null,
      currency: winner.currency_id ?? 'ARS'
    }
  }

  return null
}
