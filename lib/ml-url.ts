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
