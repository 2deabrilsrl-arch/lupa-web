/**
 * Normalize fetching ML data — accepts either an item ID (/items/{id}) or a
 * catalog product ID (/products/{id}) and returns a unified shape we can
 * store in our `items` table.
 */
import { mlFetch } from './ml-service'

export interface NormalizedMlInfo {
  ml_id: string
  source: 'item' | 'product' | 'user_product'
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
  /** Status de /items/{id}: null si ni se intentó, 0 si tiró excepción. */
  itemStatus: number | null
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
  const diag: MlFetchDiag = { itemStatus: null, productStatus: null, listingStatus: null }

  // 1. Try as a listing (item) — sólo si el ID TIENE forma de publicación.
  //
  // La corrida del 17-nov: item:404 653, item:403 247. O sea, /items/{id} no
  // resolvió ni uno de los 900 y lo llamábamos igual en todos. Los 653 son IDs
  // de catálogo, que por definición no existen en /items/: esa llamada es
  // basura pura y es el 73% de los items de cada lote.
  /**
   * Páginas /up/ (user product): MLAU..., MLMU... Son 4.946 items, el 34% del
   * catálogo, y hasta hoy el cron los salteaba porque ni /items/{id} ni
   * /products/{id} los resuelven.
   *
   * El diagnóstico del 17-nov probó 8 formas de endpoint contra tres de ellos
   * y encontró exactamente una que anda: /products/{id}/items devuelve 200 con
   * las publicaciones reales y su precio, en los tres casos. Las otras siete
   * dan 403 o 404, incluido /user-products/{id}, que contesta "caller is not
   * allowed to access this user product".
   *
   * Vamos directo a esa: llamar a las otras dos antes sería gastar dos
   * llamadas por item para recibir dos errores conocidos.
   */
  if (esIdDeUserProduct(mlId)) {
    const listing = await fetchListingData(mlId, diag)
    if (!listing || !listing.price) return { info: null, diag }
    return {
      diag,
      info: {
        ml_id: mlId,
        source: 'user_product',
        // El título, la miniatura y el permalink de estos items ya están en
        // nuestra base: los cargó la extensión desde la página real. Acá sólo
        // venimos a buscar el precio, y el cron no pisa esos campos.
        title: '',
        thumbnail_url: null,
        permalink: null,
        category_id: listing.category_id,
        seller_id: listing.seller_id || null,
        site_id: mlId.slice(0, 3),
        price: listing.price,
        original_price: listing.original_price,
        currency: listing.currency,
        free_shipping: false,
        shipping_mode: null,
        condition: null,
        category_source: listing.category_id ? 'listing' : null
      }
    }
  }

  let itemData: ItemResp | null = null

  if (!esIdDeCatalogo(mlId)) {
    let itemRes: Response | null = null
    try {
      itemRes = await mlFetch(`/items/${mlId}`)
      diag.itemStatus = itemRes.status
    } catch {
      diag.itemStatus = 0
    }

    if (itemRes && itemRes.ok) {
      itemData = (await itemRes.json()) as ItemResp
    }
    // El multiget /items?ids= se probó el 17-nov con los 91 items que dieron
    // 403: devolvió 403 en los 91. Esas publicaciones no son legibles con un
    // token de servicio que no es el del vendedor, por ninguna vía. No hay
    // nada que reintentar: se dejan caer por strikes como cualquier item
    // muerto, y /track las reactiva si un usuario las visita.
  }

  if (itemData) {
    const data = itemData
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

/**
 * Los IDs de catálogo son prefijo de sitio + menos de 10 dígitos (MLA47207534).
 * Las publicaciones tienen 10 o más. Las páginas /up/ llevan una U extra
 * después del prefijo y no las resuelve ningún endpoint.
 */
function esIdDeCatalogo(mlId: string): boolean {
  return /^[A-Z]{3}[0-9]{1,9}$/.test(mlId)
}

/** Páginas "user product": prefijo de sitio + U + dígitos (MLAU5383892195). */
function esIdDeUserProduct(mlId: string): boolean {
  return /^[A-Z]{3}U[0-9]+$/.test(mlId)
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
