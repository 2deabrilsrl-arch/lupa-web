import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from './supabase'
import { mlFetch } from './ml-service'

const MODEL = 'claude-opus-4-7'
const MIN_REVIEWS_TO_ANALYZE = 5
const MAX_REVIEWS_PER_ANALYSIS = 50
const REANALYSIS_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

let _anthropic: Anthropic | null = null
function client(): Anthropic {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured')
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _anthropic
}

const SYSTEM_PROMPT = `Sos un analizador especializado de reseñas de productos en MercadoLibre Argentina.

Tu trabajo es leer las reseñas de un producto y producir un análisis estructurado en español rioplatense (vos, no usted) que ayude a un comprador argentino a decidir si comprar o no.

REGLAS DE ESTILO:
- Español argentino natural: "vos sos", "tenés", "compré", "te conviene".
- Nunca uses "tú" ni "usted".
- Tono claro, directo, honesto. Sin tecnicismos.
- Sin emojis salvo que aporten información (⚠️ para alertas serias).

REGLAS DE CONTENIDO:
- Identificá patrones que aparezcan en MÚLTIPLES reseñas, no opiniones individuales.
- Si las reseñas son malas, decilo claro — no suavices ni vendas.
- Si las reseñas son polarizadas (mitad 5, mitad 1), mencionalo en el resumen.
- Para ropa/calzado: detectá patrones de talle ("vienen más chicos", "más grandes", "fiel al talle", "compralo un talle más"). Si el producto no es ropa o no se mencionan talles, devolvé sizing_notes: null.
- Detectá problemas recurrentes mencionados en varias reseñas: defectos de fábrica, demoras de envío, paquetes que no llegan, calidad inferior a la foto, productos rotos.
- Detectá fortalezas reales: durabilidad confirmada, atención del vendedor, mejor que lo esperado, buena relación precio/calidad.

REGLAS PARA PROS Y CONS:
- Máximo 5 de cada uno. Si no hay suficientes, devolvé menos.
- Cada uno: frase corta, < 60 caracteres, directa. Ejemplos: "Llegó rápido y bien embalado", "El cuero parece sintético", "Talle viene chico, pedí uno más".
- No incluyas reviews que solo dicen "bueno", "ok", "lindo" sin sustancia.
- No repitas la misma idea en pros y cons (elegí en cuál encaja mejor).

REGLAS PARA SENTIMENT_SCORE:
- 0.0 = la mayoría son terribles (1-2 estrellas dominantes)
- 0.3 = mezclado tirando a malo
- 0.5 = mezclado o muy polarizado (mitad 5, mitad 1)
- 0.7 = mayoría positivo con algunas quejas legítimas
- 1.0 = todas o casi todas son excelentes (4-5 estrellas)
- Pesá lo que dicen las reseñas, no solo el rating numérico.

REGLAS PARA AI_SUMMARY:
- 2-3 oraciones máximo.
- Captá la esencia: ¿qué dicen los compradores en general?
- Si hay <10 reseñas, mencionalo: "Con pocas reseñas todavía, los primeros compradores destacan...".
- Si hay un problema recurrente importante (ej: muchos productos defectuosos), levantalo en el resumen, no solo en cons.

EDGE CASES:
- Reseñas en portugués o inglés: tradujelas mentalmente y analizalas.
- Spam evidente o reseñas falsas (texto idéntico, elogios genéricos sin contenido): ignoralos.
- Un único reviewer escribiendo varias reseñas: detectalo y no infles los pros/cons con eso.

DEVOLVÉ SIEMPRE el JSON estructurado completo, sin texto extra antes ni después.`

const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    ai_summary: {
      type: 'string',
      description: 'Resumen de 2-3 oraciones en español rioplatense'
    },
    pros: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 5,
      description: 'Hasta 5 puntos positivos, frases cortas <60 chars'
    },
    cons: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 5,
      description: 'Hasta 5 puntos negativos, frases cortas <60 chars'
    },
    sizing_notes: {
      type: ['string', 'null'],
      description: 'Notas de talle si aplica (ej: "Vienen más chicos, pedí uno más"). null si no es ropa/calzado o no se menciona.'
    },
    sentiment_score: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: '0 = terribles, 0.5 = mezclado, 1 = excelentes'
    }
  },
  required: ['ai_summary', 'pros', 'cons', 'sentiment_score'],
  additionalProperties: false
} as const

interface MlReview {
  id?: string
  rate?: number
  rating?: number
  content?: string
  comment?: string
  title?: string
}

interface MlReviewsResponse {
  paging?: { total: number }
  reviews?: MlReview[]
}

export async function fetchMlReviews(mlItemId: string, limit = MAX_REVIEWS_PER_ANALYSIS): Promise<MlReview[]> {
  try {
    const res = await mlFetch(`/reviews/item/${mlItemId}?limit=${limit}`)
    if (!res.ok) {
      console.warn('[Reviews] Fetch failed', mlItemId, res.status)
      return []
    }
    const data = (await res.json()) as MlReviewsResponse
    return data.reviews ?? []
  } catch (err) {
    console.error('[Reviews] Fetch error', mlItemId, err)
    return []
  }
}

export interface ReviewsAnalysisResult {
  ai_summary: string
  pros: string[]
  cons: string[]
  sizing_notes: string | null
  sentiment_score: number
  total_reviews: number
  avg_rating: number
}

export async function analyzeReviews(
  productTitle: string,
  reviews: MlReview[]
): Promise<ReviewsAnalysisResult | null> {
  const usable = reviews.filter(r => {
    const text = (r.content ?? r.comment ?? '').trim()
    return text.length > 5
  })

  if (usable.length < MIN_REVIEWS_TO_ANALYZE) return null

  const totalReviews = usable.length
  const ratings = usable.map(r => r.rate ?? r.rating ?? 0).filter(n => n > 0)
  const avgRating = ratings.length > 0 ? ratings.reduce((s, n) => s + n, 0) / ratings.length : 0

  const reviewsText = usable
    .slice(0, MAX_REVIEWS_PER_ANALYSIS)
    .map((r, i) => {
      const rating = r.rate ?? r.rating ?? '?'
      const text = (r.content ?? r.comment ?? '').trim()
      return `[Reseña ${i + 1} — ${rating}/5] ${text}`
    })
    .join('\n\n')

  const userPrompt = `Producto: ${productTitle}

Total: ${totalReviews} reseñas con contenido. Rating promedio: ${avgRating.toFixed(1)}/5.

Reseñas:

${reviewsText}`

  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 2048,
    thinking: { type: 'adaptive' },
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' }
      }
    ],
    messages: [{ role: 'user', content: userPrompt }],
    output_config: {
      format: { type: 'json_schema', schema: ANALYSIS_SCHEMA }
    }
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    console.error('[Reviews] No text block in response')
    return null
  }

  try {
    const parsed = JSON.parse(textBlock.text) as {
      ai_summary: string
      pros: string[]
      cons: string[]
      sizing_notes: string | null
      sentiment_score: number
    }
    return {
      ai_summary: parsed.ai_summary,
      pros: parsed.pros ?? [],
      cons: parsed.cons ?? [],
      sizing_notes: parsed.sizing_notes ?? null,
      sentiment_score: parsed.sentiment_score,
      total_reviews: totalReviews,
      avg_rating: Number(avgRating.toFixed(2))
    }
  } catch (err) {
    console.error('[Reviews] JSON parse failed', err, textBlock.text.slice(0, 300))
    return null
  }
}

export async function analyzeAndStoreReviews(
  itemId: number,
  mlItemId: string,
  productTitle: string
): Promise<{ ok: boolean; message: string }> {
  const { data: existing } = await supabaseAdmin
    .from('reviews_analysis')
    .select('analyzed_at')
    .eq('item_id', itemId)
    .order('analyzed_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ analyzed_at: string }>()

  if (existing) {
    const ageMs = Date.now() - new Date(existing.analyzed_at).getTime()
    if (ageMs < REANALYSIS_INTERVAL_MS) {
      return { ok: false, message: `Analyzed recently (${Math.round(ageMs / 86400000)}d ago)` }
    }
  }

  const reviews = await fetchMlReviews(mlItemId)
  if (reviews.length < MIN_REVIEWS_TO_ANALYZE) {
    return { ok: false, message: `Only ${reviews.length} reviews — need ${MIN_REVIEWS_TO_ANALYZE}+` }
  }

  const analysis = await analyzeReviews(productTitle, reviews)
  if (!analysis) return { ok: false, message: 'Analysis returned no result' }

  const { error } = await supabaseAdmin.from('reviews_analysis').insert({
    item_id: itemId,
    total_reviews: analysis.total_reviews,
    avg_rating: analysis.avg_rating,
    ai_summary: analysis.ai_summary,
    pros: analysis.pros,
    cons: analysis.cons,
    sizing_notes: analysis.sizing_notes,
    sentiment_score: analysis.sentiment_score,
    model_used: MODEL
  })

  if (error) {
    console.error('[Reviews] Insert failed', error)
    return { ok: false, message: error.message }
  }

  return { ok: true, message: `Analyzed ${analysis.total_reviews} reseñas` }
}

export async function processReviewsBatch(): Promise<{
  total: number
  analyzed: number
  skipped: number
  errors: number
}> {
  const { data: items, error } = await supabaseAdmin
    .from('items')
    .select('id, ml_item_id, title')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('last_seen_at', { ascending: false })
    .limit(30)

  if (error || !items || items.length === 0) {
    return { total: 0, analyzed: 0, skipped: 0, errors: 0 }
  }

  let analyzed = 0
  let skipped = 0
  let errors = 0

  for (const item of items) {
    try {
      const result = await analyzeAndStoreReviews(item.id, item.ml_item_id, item.title)
      if (result.ok) analyzed++
      else skipped++
      await new Promise(r => setTimeout(r, 1500))
    } catch (err) {
      console.error('[Reviews] Batch error', item.id, err)
      errors++
    }
  }

  return { total: items.length, analyzed, skipped, errors }
}
