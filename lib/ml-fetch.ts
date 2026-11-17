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
  /** De dónde salió finalmente la categoría. Sólo para diagnóstico. */
  category_source?: 'product' | 'listing' | null
}

/**
 * Diagnóstico de la cadena de endpoints. El cron lo agrega para saber qué está
 * fallando sin tener que adivinar: una corrida del 17-nov dio fromItem 0 y
 * fromProduct 460, o sea que /items/{id} no resolvió NI UNO de los 600, y aun
 * así lo seguimos llamando primero en cada item. Duplicar las llamadas a ML
 * para nada es caro cuando el cron está paralelizado.
 */
export interface MlFetchDiag {
  /** Status de /items/{id}; 0 si la llamada tiró excepción. */
  itemStatus: number
  /** Status de /products/{id}; null si no se llegó a llamar. */
  productStatus: number | null
  /** Status de /products/{id}/items; null si no se llegó a llamar. */
  listingStatus: number | null
}

export interface MlFetchResult {
  info: NormalizedMlInfo | null
  diag: MlFetchDiag
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

/** Compatibilidad: el resto de la app sigue llamando a esto. */
export async function fetchMlInfo(mlId: string): Promise<NormalizedMlInfo | null> {
  const { info } = await fetchMlInfoDetailed(mlId)
  return info
}

export async function fetchMlInfoDetailed(mlId: string): Promise<MlFetchResult> {
  const diag: MlFetchDiag = { itemStatus: 0, productStatus: null, listingStatus: null }

  // 1. Try as a listing (item)
  let itemRes: Response | null = null
  try {
    itemRes = await mlFetch(`/items/${mlId}`)
    diag.itemStatus = itemRes.status
  } catch {
    diag.itemStatus = 0
  }

  if (itemRes && itemRes.ok) {
    const data = (await itemRes.json()) as ItemResp
    const price = data.sale_price?.amount ?? data.price ?? null
    return {
      diag,
      info: {
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
        condition: data.condition ?? null,
        category_source: data.category_id ? 'product' : null
      }
    }
  }

  // 2. Fall back to catalog product
  let prodRes: Response | null = null
  try {
    prodRes = await mlFetch(`/products/${mlId}`)
    diag.productStatus = prodRes.status
  } catch {
    diag.productStatus = 0
  }

  if (prodRes && prodRes.ok) {
    const data = (await prodRes.json()) as ProductResp
    const winner = data.buy_box_winner

    let price = winner?.price ?? null
    let originalPrice = winner?.original_price ?? null
    let currency = winner?.currency_id ?? 'ARS'
    let sellerId = winner?.seller_id ?? null
    let categoryId = data.category_id ?? null
    let categorySource: 'product' | 'listing' | null = categoryId ? 'product' : null

    /**
     * Pedimos las publicaciones del catálogo si falta el precio O si falta la
     * categoría.
     *
     * Lo segundo es nuevo y es el arreglo de `categorized: 0`. La corrida del
     * 17-nov dio noIdFromMl 354 sobre 354 actualizados y lookupFailed 0: el
     * endpoint /products/{id} simplemente NO trae category_id, y como todo el
     * catálogo entra por ese camino (fromProduct 460, fromItem 0), ningún item
     * se categorizó nunca y ml_categories quedó vacía desde siempre.
     *
     * Las publicaciones de abajo del catálogo sí traen category_id, y esta
     * llamada ya existía para sacar el precio. Cuando el item ya tiene
     * categoría guardada, el cron no pide nada: el costo es una llamada extra
     * por item y por única vez.
     */
    if (price == null || categoryId == null) {
      const listing = await fetchListingData(mlId, diag)
      if (listing) {
        if (price == null) {
          price = listing.price
          originalPrice = listing.original_price
          currency = listing.currency
          sellerId = listing.seller_id
        }
        if (categoryId == null && listing.category_id) {
          categoryId = listing.category_id
          categorySource = 'listing'
        }
      }
    }

    return {
      diag,
      info: {
        ml_id: data.id,
        source: 'product',
        title: data.name ?? '(sin título)',
        thumbnail_url: data.pictures?.[0]?.url ?? null,
        permalink: data.permalink ?? null,
        category_id: categoryId,
        seller_id: sellerId,
        site_id: data.site_id ?? mlId.slice(0, 3),
        price,
        original_price: originalPrice,
        currency,
        free_shipping: false,
        shipping_mode: null,
        condition: null,
        category_source: categorySource
      }
    }
  }

  return { info: null, diag }
}

interface ProductItemListing {
  item_id: string
  seller_id: number
  price: number
  original_price: number | null
  currency_id: string
  condition: string
  category_id?: string | null
}

/**
 * For catalog products with no buy_box_winner, query the listings under that
 * catalog and return the cheapest "new" one. Anchors price tracking to a real
 * sellable price even when ML hides buy_box from the API.
 *
 * Devuelve también el category_id de la publicación: el catálogo no lo trae y
 * es la única fuente de categoría que tenemos para esos productos.
 */
async function fetchListingData(catalogId: string, diag: MlFetchDiag): Promise<{
  price: number
  original_price: number | null
  currency: string
  seller_id: number
  category_id: string | null
} | null> {
  try {
    const res = await mlFetch(`/products/${catalogId}/items?limit=10`)
    diag.listingStatus = res.status
    if (!res.ok) return null
    const data = (await res.json()) as { results?: ProductItemListing[] }
    const results = data.results ?? []
    // La categoría la tomamos de cualquier publicación que la traiga, aunque
    // sea usada o sin precio: la categoría del producto no depende de eso.
    const categoryId = results.find(i => i.category_id)?.category_id ?? null

    const sellable = results
      .filter(i => i.price && i.price > 0 && i.condition === 'new')
      .sort((a, b) => a.price - b.price)

    if (sellable.length === 0) {
      return categoryId
        ? { price: 0, original_price: null, currency: 'ARS', seller_id: 0, category_id: categoryId }
        : null
    }

    const cheapest = sellable[0]
    return {
      price: cheapest.price,
      original_price: cheapest.original_price,
      currency: cheapest.currency_id ?? 'ARS',
      seller_id: cheapest.seller_id,
      category_id: categoryId
    }
  } catch {
    diag.listingStatus = 0
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
