import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { mlFetch } from '@/lib/ml-service'
import { fetchMlInfo } from '@/lib/ml-fetch'

/**
 * Discovery cron — pulls best-sellers per tracked category from ML's
 * /highlights/{site}/category/{cat_id} endpoint and ingests them into items.
 *
 * Each highlight ID is then resolved via /products/{id} (or /items/{id}) to
 * get title + price + thumbnail, and inserted with price_history seeded.
 *
 * This runs daily and grows the catalog without requiring user discovery.
 */
export const maxDuration = 300

const TOP_N_PER_CATEGORY = 8
const MAX_CATEGORIES_PER_RUN = 22

interface HighlightEntry {
  id: string
  position: number
  type: 'PRODUCT' | 'USER_PRODUCT' | string
}

interface HighlightsResponse {
  query_data: { highlight_type: string; criteria: string; id: string }
  content?: HighlightEntry[]
}

interface CategoryRow {
  id: number
  ml_category_id: string
  name: string
  priority: number | null
  last_crawled_at: string | null
  items_count: number | null
}

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: categories, error: catErr } = await supabaseAdmin
    .from('tracked_categories')
    .select('id, ml_category_id, name, priority, last_crawled_at, items_count')
    .eq('is_active', true)
    .order('last_crawled_at', { ascending: true, nullsFirst: true })
    .limit(MAX_CATEGORIES_PER_RUN)
    .returns<CategoryRow[]>()

  if (catErr || !categories || categories.length === 0) {
    return NextResponse.json({ error: 'No categories', cause: catErr?.message })
  }

  let categoriesProcessed = 0
  let candidatesSeen = 0
  let inserted = 0
  let alreadyExisted = 0
  let skipped = 0
  let errors = 0

  for (const cat of categories) {
    try {
      const res = await mlFetch(`/highlights/MLA/category/${cat.ml_category_id}`)
      if (!res.ok) {
        console.warn('[Discover] highlights failed', cat.ml_category_id, res.status)
        errors++
        continue
      }
      const data = (await res.json()) as HighlightsResponse
      const entries = (data.content ?? []).slice(0, TOP_N_PER_CATEGORY)

      let newInThisCat = 0

      for (const entry of entries) {
        candidatesSeen++

        // Skip USER_PRODUCT (those are individual seller listings, less useful for catalog tracking)
        if (entry.type !== 'PRODUCT') {
          skipped++
          continue
        }

        // Already in DB?
        const { data: existing } = await supabaseAdmin
          .from('items')
          .select('id')
          .eq('ml_item_id', entry.id)
          .maybeSingle()
        if (existing) {
          alreadyExisted++
          continue
        }

        // Fetch product details
        const ml = await fetchMlInfo(entry.id)
        if (!ml || !ml.price || ml.price === 0) {
          // Skip catalog products without active sellers
          skipped++
          continue
        }

        // Insert item
        const { data: created } = await supabaseAdmin
          .from('items')
          .insert({
            ml_item_id: ml.ml_id,
            title: ml.title,
            thumbnail_url: ml.thumbnail_url,
            permalink: ml.permalink,
            category_id: ml.category_id ?? cat.ml_category_id,
            category_name: cat.name,
            seller_id: ml.seller_id,
            site_id: ml.site_id,
            condition: ml.condition,
            free_shipping: ml.free_shipping,
            shipping_mode: ml.shipping_mode,
            is_active: true
          })
          .select('id')
          .single<{ id: number }>()

        if (!created) {
          errors++
          continue
        }

        // Seed price history
        await supabaseAdmin.rpc('insert_price_if_changed', {
          p_item_id: created.id,
          p_price: ml.price,
          p_original_price: ml.original_price,
          p_currency: ml.currency,
          p_discount_percent: null,
          p_price_type: ml.original_price ? 'promotion' : 'standard',
          p_source: 'discovery'
        })

        inserted++
        newInThisCat++

        // Be polite to ML
        await new Promise(r => setTimeout(r, 800))
      }

      // Update category metadata
      await supabaseAdmin
        .from('tracked_categories')
        .update({
          last_crawled_at: new Date().toISOString(),
          items_count: (cat.items_count ?? 0) + newInThisCat
        })
        .eq('id', cat.id)

      categoriesProcessed++
    } catch (err) {
      console.error('[Discover] Category error', cat.ml_category_id, err)
      errors++
    }
  }

  return NextResponse.json({
    message: 'Discovery completed',
    categoriesProcessed,
    candidatesSeen,
    inserted,
    alreadyExisted,
    skipped,
    errors,
    timestamp: new Date().toISOString()
  })
}
