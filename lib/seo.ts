/**
 * Helpers de SEO: slugs de categoría y el resumen de texto que se genera desde
 * los propios datos de precio.
 *
 * El texto es determinístico (sin IA) y se omite si no hay datos suficientes:
 * es la única parte de la ficha que es contenido propio y no una repetición de
 * lo que ya dice MercadoLibre.
 */
import { formatPrice } from './format'

export const BASE_URL = 'https://lupaprecios.com'

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export interface PricePoint {
  price: number
  captured_at: string
}

/**
 * Resumen en prosa del historial. Devuelve null si hay menos de 3 registros —
 * con dos puntos no hay nada honesto que contar.
 */
export function buildPriceSummary(
  title: string,
  history: PricePoint[],
  currency: string
): string | null {
  if (history.length < 3) return null

  // history llega DESC (más reciente primero)
  const latest = history[0]
  const prices = history.map(h => Number(h.price))
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length

  const minPoint = history.find(h => Number(h.price) === min)!
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })

  const parts: string[] = []

  // 1. Qué pasó en los últimos 30 días
  const cutoff30 = Date.now() - 30 * 24 * 60 * 60 * 1000
  const older = history.find(h => new Date(h.captured_at).getTime() <= cutoff30)
  const current = Number(latest.price)
  if (older) {
    const oldPrice = Number(older.price)
    const change = ((current - oldPrice) / oldPrice) * 100
    if (Math.abs(change) < 2) {
      parts.push(
        `El precio de ${title} se mantuvo estable en los últimos 30 días: hoy está en ${formatPrice(current, currency)}, prácticamente lo mismo que hace un mes.`
      )
    } else if (change < 0) {
      parts.push(
        `El precio de ${title} bajó un ${Math.abs(Math.round(change))}% en los últimos 30 días, de ${formatPrice(oldPrice, currency)} a ${formatPrice(current, currency)}.`
      )
    } else {
      parts.push(
        `El precio de ${title} subió un ${Math.round(change)}% en los últimos 30 días, de ${formatPrice(oldPrice, currency)} a ${formatPrice(current, currency)}.`
      )
    }
  } else {
    parts.push(
      `${title} se vende hoy a ${formatPrice(current, currency)} en MercadoLibre.`
    )
  }

  // 2. Mínimo y máximo del período
  parts.push(
    `Su precio más bajo registrado fue de ${formatPrice(min, currency)} el ${fmtDate(minPoint.captured_at)}, y el más alto de ${formatPrice(max, currency)}.`
  )

  // 3. Dónde está parado hoy contra el promedio
  const vsAvg = ((current - avg) / avg) * 100
  if (current <= min * 1.02) {
    parts.push(
      `Hoy está en su mínimo histórico desde que lo seguimos, así que es un buen momento para comprarlo.`
    )
  } else if (vsAvg < -3) {
    parts.push(
      `Hoy está un ${Math.abs(Math.round(vsAvg))}% por debajo del promedio de ${formatPrice(avg, currency)}, o sea que está más barato de lo habitual.`
    )
  } else if (vsAvg > 3) {
    parts.push(
      `Hoy está un ${Math.round(vsAvg)}% por encima del promedio de ${formatPrice(avg, currency)}, así que puede convenir esperar.`
    )
  } else {
    parts.push(
      `Hoy está en línea con su promedio de ${formatPrice(avg, currency)}.`
    )
  }

  parts.push(`Basado en ${history.length} registros de precio.`)

  return parts.join(' ')
}

/** Dominio de ML por sitio, para el breadcrumb y los links salientes. */
export const COUNTRY_BY_SITE: Record<string, string> = {
  MLA: 'Argentina',
  MLB: 'Brasil',
  MLM: 'México',
  MLC: 'Chile',
  MCO: 'Colombia',
  MLU: 'Uruguay',
  MPE: 'Perú'
}
