/**
 * Formatting helpers for multi-region pricing and country display.
 */

const LOCALE_BY_CURRENCY: Record<string, string> = {
  ARS: 'es-AR',
  BRL: 'pt-BR',
  MXN: 'es-MX',
  CLP: 'es-CL',
  COP: 'es-CO',
  UYU: 'es-UY',
  PEN: 'es-PE',
  USD: 'en-US'
}

const FLAG_BY_SITE: Record<string, string> = {
  MLA: '🇦🇷',
  MLB: '🇧🇷',
  MLM: '🇲🇽',
  MLC: '🇨🇱',
  MCO: '🇨🇴',
  MLU: '🇺🇾',
  MPE: '🇵🇪',
  MEC: '🇪🇨',
  MPY: '🇵🇾',
  MBO: '🇧🇴',
  MRD: '🇩🇴'
}

const COUNTRY_NAME_BY_SITE: Record<string, string> = {
  MLA: 'Argentina',
  MLB: 'Brasil',
  MLM: 'México',
  MLC: 'Chile',
  MCO: 'Colombia',
  MLU: 'Uruguay',
  MPE: 'Perú',
  MEC: 'Ecuador',
  MPY: 'Paraguay',
  MBO: 'Bolivia',
  MRD: 'República Dominicana'
}

export function formatPrice(amount: number | null | undefined, currency = 'ARS'): string {
  if (amount == null || !Number.isFinite(Number(amount))) return '—'
  const cur = currency || 'ARS'
  const locale = LOCALE_BY_CURRENCY[cur] || 'es-AR'
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 0
    }).format(Number(amount))
  } catch {
    return `${cur} ${Math.round(Number(amount)).toLocaleString(locale)}`
  }
}

export function flagForSite(siteId: string | null | undefined): string {
  if (!siteId) return '🌎'
  return FLAG_BY_SITE[siteId] ?? '🌎'
}

export function countryNameForSite(siteId: string | null | undefined): string {
  if (!siteId) return 'Internacional'
  return COUNTRY_NAME_BY_SITE[siteId] ?? siteId
}

const ML_DOMAIN_BY_SITE: Record<string, string> = {
  MLA: 'mercadolibre.com.ar',
  MLB: 'mercadolivre.com.br',
  MLM: 'mercadolibre.com.mx',
  MLC: 'mercadolibre.cl',
  MCO: 'mercadolibre.com.co',
  MLU: 'mercadolibre.com.uy',
  MPE: 'mercadolibre.com.pe',
  MEC: 'mercadolibre.com.ec',
  MPY: 'mercadolibre.com.py',
  MBO: 'mercadolibre.com.bo',
  MRD: 'mercadolibre.com.do'
}

/**
 * Build a working ML web URL for a given catalog/item ID. Used as a fallback
 * when the stored `permalink` is empty (catalog products often have no slug).
 */
export function mlWebUrl(mlItemId: string, siteId: string | null | undefined): string {
  const domain = (siteId && ML_DOMAIN_BY_SITE[siteId]) || 'mercadolibre.com.ar'
  return `https://www.${domain}/p/${mlItemId}`
}

export const SUPPORTED_SITES = [
  'MLA',
  'MLB',
  'MLM',
  'MLC',
  'MCO',
  'MLU',
  'MPE'
] as const

export type SiteId = (typeof SUPPORTED_SITES)[number]
