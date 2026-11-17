import { NextResponse } from 'next/server'
import { processReviewsBatch } from '@/lib/reviews'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 300

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await processReviewsBatch()

  // El percentil de sentimiento es relativo a todo el corpus, así que cambia
  // cada vez que entran análisis nuevos. Recalcularlo acá cuesta un UPDATE
  // sobre ~1.700 filas cada 6 horas y deja la lectura gratis en la ficha y en
  // el Deal Score.
  let percentilesActualizados: number | null = null
  const { data: filas, error: errPercentil } =
    await supabaseAdmin.rpc('recalcular_sentiment_percentiles')
  if (errPercentil) {
    console.error('[Reviews] No se pudo recalcular el percentil', errPercentil)
  } else {
    percentilesActualizados = typeof filas === 'number' ? filas : null
  }

  return NextResponse.json({
    message: 'Reviews analysis completed',
    ...result,
    percentilesActualizados,
    timestamp: new Date().toISOString()
  })
}
