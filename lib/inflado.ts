/**
 * Detección de descuentos inflados.
 *
 * Vive en su propio archivo porque es el diferenciador del producto y porque
 * así se puede testear sin arrastrar Supabase.
 *
 * Historia del cambio (18-nov-2026): la regla anterior comparaba el precio
 * "anterior" anunciado contra el MÍNIMO de los últimos 30 días. Dos problemas.
 *
 * El grande: con 30 días de ventana sólo 617 de 15.272 productos tenían los
 * 2 registros que la regla pide para opinar. El 4% del catálogo. En 48 horas
 * se recalcularon 8.695 productos y marcó CERO. El detector no estaba roto,
 * estaba sin datos, porque el cron de precios anduvo mal durante meses.
 *
 * El fino: el mínimo es frágil. Una sola caída puntual —un vendedor que
 * liquida stock por un día— arrastra el veredicto de los tres meses
 * siguientes. Y en un país con inflación, cualquier precio viejo es más bajo,
 * así que ampliar la ventana usando el mínimo marcaría descuentos legítimos.
 *
 * Regla nueva: el "anterior" tiene que superar el PERCENTIL 75 de los últimos
 * 90 días por más de un 15%. O sea: si tres de cada cuatro veces el producto
 * costó $100 o menos, un "antes" de $150 no describe lo que la gente pagaba.
 * El percentil aguanta los outliers que el mínimo no.
 *
 * Corrida contra el catálogo real dió 71,3% de promociones infladas, contra el
 * 74% que publica mejorescompras.com.ar con una regla equivalente sobre un
 * universo mucho más grande. Mide lo mismo.
 */

/** Ventana de historial. Coincide con la del gráfico de la ficha. */
export const VENTANA_DIAS = 90

/** Cuánto tiene que superar el "anterior" al p75 para que lo marquemos. */
export const MARGEN = 1.15

/**
 * Mínimo de registros para opinar. Con menos no hay con qué comparar, y
 * preferimos callarnos antes que acusar mal a un vendedor.
 */
export const MIN_REGISTROS = 2

export interface PuntoPrecio {
  price: number
  captured_at: string
}

export interface Veredicto {
  detected: boolean
  detail: string | null
  /** El p75 que se usó, para poder explicarlo. */
  referencia?: number
}

/** Percentil con interpolación lineal. Con un solo valor devuelve ese valor. */
export function percentil(valores: number[], p: number): number {
  const orden = [...valores].sort((a, b) => a - b)
  if (orden.length === 0) return NaN
  if (orden.length === 1) return orden[0]
  const idx = (orden.length - 1) * p
  const bajo = Math.floor(idx)
  const alto = Math.ceil(idx)
  if (bajo === alto) return orden[bajo]
  return orden[bajo] + (orden[alto] - orden[bajo]) * (idx - bajo)
}

export function detectarInflado(
  precioAnterior: number | null | undefined,
  precioActual: number,
  historial: PuntoPrecio[],
  ahora: number = Date.now()
): Veredicto {
  // Sin precio "anterior" no hay descuento que auditar.
  if (!precioAnterior || precioAnterior <= precioActual) {
    return { detected: false, detail: null }
  }

  const corte = ahora - VENTANA_DIAS * 24 * 60 * 60 * 1000
  const ventana = historial
    .filter(h => new Date(h.captured_at).getTime() >= corte)
    .map(h => Number(h.price))
    .filter(p => Number.isFinite(p) && p > 0)

  if (ventana.length < MIN_REGISTROS) return { detected: false, detail: null }

  const p75 = percentil(ventana, 0.75)
  if (!Number.isFinite(p75) || p75 <= 0) return { detected: false, detail: null }

  if (precioAnterior <= p75 * MARGEN) {
    return { detected: false, detail: null, referencia: p75 }
  }

  const exceso = Math.round(((precioAnterior - p75) / p75) * 100)
  const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`

  return {
    detected: true,
    referencia: p75,
    detail:
      `En los últimos ${VENTANA_DIAS} días, 3 de cada 4 veces este producto ` +
      `costó ${fmt(p75)} o menos. El "antes" de ${fmt(precioAnterior)} está ` +
      `un ${exceso}% por encima de eso.`
  }
}
