/**
 * Helpers compartidos para normalizar datos que entran desde la extensión.
 * Espejo de lo que hace `src/lib/ml-parse.ts` en el repo de la extensión: el
 * servidor no puede confiar en que el cliente haya limpiado nada.
 */

const CURRENCY_BY_SITE: Record<string, string> = {
  MLA: 'ARS',
  MLB: 'BRL',
  MLM: 'MXN',
  MLC: 'CLP',
  MCO: 'COP',
  MLU: 'UYU',
  MPE: 'PEN',
  MEC: 'USD',
  MPY: 'USD',
  MBO: 'BOB',
  MRD: 'DOP'
}

/** Sufijo de precio que ML mete en el og:title: " - $ 38.813,77", " - S/ 199.9". */
const PRICE_SUFFIX_RE = /\s*[-–—]\s*(US\$|R\$|S\/|\$)\s*[\d.,]+\s*$/

export function currencyForSite(siteId: string | null | undefined): string {
  if (!siteId) return 'ARS'
  return CURRENCY_BY_SITE[siteId] ?? 'ARS'
}

export function cleanTitle(title: string | null | undefined): string {
  if (!title) return ''
  return title.replace(PRICE_SUFFIX_RE, '').trim()
}

export function hasPriceSuffix(title: string | null | undefined): boolean {
  return !!title && PRICE_SUFFIX_RE.test(title)
}

/** Precio máximo aceptable en cualquier moneda. Por encima es basura. */
export const MAX_ACCEPTABLE_PRICE = 1_000_000_000

/** Desvío máximo contra la última captura antes de rechazar el precio. */
export const MAX_PRICE_DEVIATION_FACTOR = 10
