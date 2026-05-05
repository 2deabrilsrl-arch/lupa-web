/**
 * Extract a normalized MercadoLibre item ID from a URL or a raw ID string.
 * Returns null if nothing recognizable was found.
 *
 * Supported inputs:
 *  - https://articulo.mercadolibre.com.ar/MLA-12345-...
 *  - https://www.mercadolibre.com.ar/p/MLA12345
 *  - https://produto.mercadolivre.com.br/MLB-12345-...
 *  - MLA12345678
 *  - MLA-12345678
 *  - mla12345678 (case-insensitive)
 */
const ML_ID_REGEX = /\b(M[LCP][AUMBC]?[A-Z]?)[-]?(\d{6,})\b/i

export function extractMlItemId(input: string): string | null {
  if (!input) return null
  const cleaned = input.trim()
  const match = cleaned.match(ML_ID_REGEX)
  if (!match) return null
  return `${match[1].toUpperCase()}${match[2]}`
}

export function siteIdFromMlId(mlItemId: string): string {
  const prefix = mlItemId.slice(0, 3).toUpperCase()
  return prefix
}

const ML_HOST_BY_SITE: Record<string, string> = {
  MLA: 'mercadolibre.com.ar',
  MLM: 'mercadolibre.com.mx',
  MLU: 'mercadolibre.com.uy',
  MLC: 'mercadolibre.cl',
  MCO: 'mercadolibre.com.co',
  MPE: 'mercadolibre.com.pe',
  MLB: 'mercadolivre.com.br'
}

/** Country options for UI selectors. Keep MLA first (default market). */
export const ML_SITES: Array<{ id: string; label: string; flag: string }> = [
  { id: 'MLA', label: 'Argentina', flag: '🇦🇷' },
  { id: 'MLM', label: 'México', flag: '🇲🇽' },
  { id: 'MLB', label: 'Brasil', flag: '🇧🇷' },
  { id: 'MLC', label: 'Chile', flag: '🇨🇱' },
  { id: 'MCO', label: 'Colombia', flag: '🇨🇴' },
  { id: 'MPE', label: 'Perú', flag: '🇵🇪' },
  { id: 'MLU', label: 'Uruguay', flag: '🇺🇾' }
]

export function mlHostFromSiteId(siteId: string | null | undefined): string {
  if (!siteId) return ML_HOST_BY_SITE.MLA
  return ML_HOST_BY_SITE[siteId.toUpperCase()] ?? ML_HOST_BY_SITE.MLA
}

/**
 * Build a product URL given a (possibly null) permalink and the item's site_id.
 * Prefers the stored permalink because it is the source of truth from ML;
 * falls back to a constructed URL using the correct country host so we never
 * mix MLA host with an MLB id (which produces 404s).
 */
export function productUrlFor(item: {
  ml_item_id: string
  site_id?: string | null
  permalink?: string | null
}): string {
  if (item.permalink) return item.permalink
  const siteId = item.site_id || siteIdFromMlId(item.ml_item_id)
  const host = mlHostFromSiteId(siteId)
  return `https://www.${host}/p/${item.ml_item_id}`
}
