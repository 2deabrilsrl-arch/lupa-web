/**
 * Deal Score — combines price history, reviews, seller, and shipping into a 1-10 score.
 *
 * Weights:
 *  40% Price history — current vs 90-day min/avg/max
 *  30% Reviews sentiment — sentiment_score from reviews_analysis
 *  20% Seller reputation — ML reputation_level + power_seller_status
 *  10% Shipping — free vs paid
 *
 * Penalty: -20 raw points if a "fake discount" is detected.
 *
 * Final raw score is clamped to [0, 100], then mapped to a 1-10 integer.
 */
import { supabaseAdmin } from './supabase'
import { fetchSellerInfo } from './ml-fetch'

export interface DealScoreFactors {
  price: number
  reviews: number
  seller: number
  shipping: number
  fake_discount_penalty: number
}

export interface DealScoreResult {
  score: number // 1..10
  raw_score: number // 0..100
  factors: DealScoreFactors
  is_fake_discount: boolean
  fake_discount_detail: string | null
  notes: string[]
}

interface ItemRow {
  id: number
  ml_item_id: string
  seller_id: number | null
  free_shipping: boolean | null
  shipping_mode: string | null
}

interface PriceHistoryStats {
  min: number
  max: number
  avg: number
  latest: number
  latest_original: number | null
  count: number
}

const REPUTATION_SCORE: Record<string, number> = {
  '5_green': 100,
  '4_light_green': 80,
  '3_yellow': 60,
  '2_orange': 35,
  '1_red': 10
}

const POWER_SELLER_BONUS: Record<string, number> = {
  platinum: 15,
  gold: 10,
  silver: 5
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function priceScoreFromHistory(stats: PriceHistoryStats): number {
  // 100 = at the historical minimum, 0 = at the historical maximum.
  // Linear interpolation between min and max.
  if (stats.count < 2 || stats.max === stats.min) return 50 // not enough data
  const ratio = (stats.latest - stats.min) / (stats.max - stats.min)
  return clamp(100 - ratio * 100, 0, 100)
}

function reviewsScoreFromSentiment(sentiment: number | null, totalReviews: number): number {
  if (sentiment == null) return 50 // no analysis yet → neutral
  // Light scaling for review volume — products with fewer reviews get pulled toward 50
  const volumeWeight = clamp(totalReviews / 50, 0.4, 1)
  return 50 + (sentiment * 100 - 50) * volumeWeight
}

async function sellerScoreFromMl(sellerId: number | null): Promise<number> {
  if (!sellerId) return 50
  const info = await fetchSellerInfo(sellerId)
  if (!info) return 50
  let base = info.reputation_level ? (REPUTATION_SCORE[info.reputation_level] ?? 50) : 50
  if (info.power_seller_status) {
    base += POWER_SELLER_BONUS[info.power_seller_status] ?? 0
  }
  return clamp(base, 0, 100)
}

function shippingScore(item: ItemRow): number {
  if (item.free_shipping) return 100
  if (item.shipping_mode === 'me1' || item.shipping_mode === 'me2') return 60
  return 40
}

function detectFakeDiscount(stats: PriceHistoryStats, history: { price: number; captured_at: string }[]): { detected: boolean; detail: string | null } {
  if (!stats.latest_original || stats.latest_original <= stats.latest) {
    return { detected: false, detail: null }
  }
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  const last30 = history.filter(h => new Date(h.captured_at).getTime() >= cutoff)
  if (last30.length < 2) return { detected: false, detail: null }
  const minLast30 = Math.min(...last30.map(h => Number(h.price)))
  if (minLast30 < stats.latest_original * 0.95) {
    return {
      detected: true,
      detail:
        `El precio ya estuvo en $${Math.round(minLast30).toLocaleString('es-AR')} en los últimos 30 días — el "precio anterior" de $${Math.round(stats.latest_original).toLocaleString('es-AR')} parece inflado.`
    }
  }
  return { detected: false, detail: null }
}

export async function computeDealScore(itemId: number): Promise<DealScoreResult | null> {
  const { data: item } = await supabaseAdmin
    .from('items')
    .select('id, ml_item_id, seller_id, free_shipping, shipping_mode')
    .eq('id', itemId)
    .maybeSingle<ItemRow & { free_shipping: boolean | null; shipping_mode: string | null }>()

  if (!item) return null

  // Price history (90 days)
  const { data: history } = await supabaseAdmin
    .from('price_history')
    .select('price, original_price, captured_at')
    .eq('item_id', itemId)
    .gte('captured_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
    .order('captured_at', { ascending: false })
    .returns<{ price: number; original_price: number | null; captured_at: string }[]>()

  if (!history || history.length === 0) return null

  const prices = history.map(h => Number(h.price))
  const stats: PriceHistoryStats = {
    min: Math.min(...prices),
    max: Math.max(...prices),
    avg: prices.reduce((a, b) => a + b, 0) / prices.length,
    latest: Number(history[0].price),
    latest_original: history[0].original_price ? Number(history[0].original_price) : null,
    count: history.length
  }

  // Reviews
  const { data: review } = await supabaseAdmin
    .from('reviews_analysis')
    .select('sentiment_score, total_reviews')
    .eq('item_id', itemId)
    .order('analyzed_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ sentiment_score: number | null; total_reviews: number | null }>()

  const factors: DealScoreFactors = {
    price: priceScoreFromHistory(stats),
    reviews: reviewsScoreFromSentiment(
      review?.sentiment_score ? Number(review.sentiment_score) : null,
      review?.total_reviews ?? 0
    ),
    seller: await sellerScoreFromMl(item.seller_id ?? null),
    shipping: shippingScore(item),
    fake_discount_penalty: 0
  }

  let raw =
    factors.price * 0.4 +
    factors.reviews * 0.3 +
    factors.seller * 0.2 +
    factors.shipping * 0.1

  const fake = detectFakeDiscount(stats, history)
  if (fake.detected) {
    factors.fake_discount_penalty = -20
    raw -= 20
  }

  raw = clamp(raw, 0, 100)
  const score = clamp(Math.round(raw / 10), 1, 10)

  const notes: string[] = []
  if (stats.count < 5) notes.push('Pocos registros de precio aún — el score se va a ajustar a medida que tengamos más datos.')
  if (review == null) notes.push('Sin análisis de reseñas todavía.')
  if (item.seller_id == null) notes.push('No tenemos info del vendedor.')

  return {
    score,
    raw_score: Math.round(raw),
    factors,
    is_fake_discount: fake.detected,
    fake_discount_detail: fake.detail,
    notes
  }
}

export async function computeAndStoreDealScore(itemId: number): Promise<DealScoreResult | null> {
  const result = await computeDealScore(itemId)
  if (!result) return null

  const { error } = await supabaseAdmin.from('deal_scores').insert({
    item_id: itemId,
    score: result.score,
    factors: {
      price: result.factors.price,
      reviews: result.factors.reviews,
      seller: result.factors.seller,
      shipping: result.factors.shipping,
      fake_discount_penalty: result.factors.fake_discount_penalty,
      raw_score: result.raw_score,
      notes: result.notes
    },
    factor_breakdown: result.factors,
    is_fake_discount: result.is_fake_discount,
    fake_discount_detail: result.fake_discount_detail
  })

  if (error) console.error('[DealScore] Insert failed', error)
  return result
}
