import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { processAlertsForItem } from '@/lib/alerts'
import { fetchMlInfo } from '@/lib/ml-fetch'
import { computeAndStoreDealScore } from '@/lib/deal-score'
import { resolveRootCategory } from '@/lib/ml-categories'

// Vercel Cron: corre cada 6 horas (configurado en vercel.json)
// Actualiza los precios de los items trackeados vía la API de ML.

export const maxDuration = 300 // 5 min, tope del plan Pro

/**
 * IDs que la API pública de ML NO resuelve: las páginas "user product" (/up/),
 * cuyo ID tiene una U extra después del prefijo de sitio (MLAU..., MLUU...).
 * Ni /items/{id} ni /products/{id} los aceptan, así que fetchMlInfo siempre
 * devuelve null. Antes copaban la cola entera del cron.
 */
const UNRESOLVABLE_ID_RE = /^(MLA|MLB|MLM|MLC|MCO|MLU|MPE|MEC|MPY|MBO|MRD)U\d+$/i

/** Fallos consecutivos tras los cuales damos el item de baja. */
const MAX_FETCH_FAILURES = 5

const BATCH_SIZE = 150
const SLEEP_MS = 1200

interface CronItem {
  id: number
  ml_item_id: string
  site_id: string | null
  fetch_failures: number | null
  category_name: string | null
}

export async function GET(request: Request) {
  // Verificar el secreto del cron (Vercel manda este header)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 1. Traer los items activos más desactualizados primero.
    //    Pedimos de más porque después filtramos los IDs irresolubles en memoria
    //    (PostgREST no expone un NOT ~ regex cómodo sobre este patrón).
    const { data: raw, error } = await supabaseAdmin
      .from('items')
      .select('id, ml_item_id, site_id, fetch_failures, category_name')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('last_seen_at', { ascending: true, nullsFirst: true })
      .limit(BATCH_SIZE * 3)
      .returns<CronItem[]>()

    if (error) throw error

    const allCandidates = raw ?? []
    const items = allCandidates
      .filter(i => !UNRESOLVABLE_ID_RE.test(i.ml_item_id))
      .slice(0, BATCH_SIZE)

    const skippedUnresolvable = allCandidates.length - allCandidates.filter(i => !UNRESOLVABLE_ID_RE.test(i.ml_item_id)).length

    if (items.length === 0) {
      return NextResponse.json({
        message: 'No items to update',
        updated: 0,
        skippedUnresolvable
      })
    }

    let updated = 0
    let scored = 0
    let errors = 0
    let deactivated = 0
    let categorized = 0

    /**
     * Marca un fallo de fetch. Clave: también movemos last_seen_at para que el
     * item rote y no vuelva a encabezar la cola en la corrida siguiente.
     */
    async function registerFailure(item: CronItem) {
      const failures = (item.fetch_failures ?? 0) + 1
      const patch: Record<string, unknown> = {
        fetch_failures: failures,
        last_seen_at: new Date().toISOString()
      }
      if (failures >= MAX_FETCH_FAILURES) {
        patch.is_active = false
        deactivated++
      }
      await supabaseAdmin.from('items').update(patch).eq('id', item.id)
    }

    // 2. Traer el precio actual de cada item (item o producto de catálogo)
    for (const item of items) {
      try {
        const mlData = await fetchMlInfo(item.ml_item_id)

        async function evaluateWithStoredPrice() {
          // Usamos el último precio guardado para evaluar alertas + Deal Score.
          // Necesario para productos de catálogo e items restringidos por ML,
          // donde el cron no puede traer precio fresco pero los precios ya
          // guardados pueden cumplir la condición de una alerta.
          const { data: latest } = await supabaseAdmin
            .from('price_history')
            .select('price')
            .eq('item_id', item.id)
            .order('captured_at', { ascending: false })
            .limit(1)
            .maybeSingle<{ price: number }>()
          if (latest) {
            await processAlertsForItem(item.id, Number(latest.price), null).catch(err =>
              console.error('[Cron] Stored-price alert eval failed', item.id, err)
            )
          }
          const result = await computeAndStoreDealScore(item.id).catch(() => null)
          if (result) scored++
        }

        if (!mlData) {
          console.log(`[Cron] ML fetch failed for ${item.ml_item_id}`)
          errors++
          await registerFailure(item)
          await evaluateWithStoredPrice()
          continue
        }

        const price = mlData.price
        const originalPrice = mlData.original_price
        const currency = mlData.currency

        if (!price || price === 0) {
          // El fetch anduvo, sólo que no hay precio activo: no es un fallo.
          await supabaseAdmin
            .from('items')
            .update({ fetch_failures: 0, last_seen_at: new Date().toISOString() })
            .eq('id', item.id)
          await evaluateWithStoredPrice()
          continue
        }

        // Calcular descuento
        let discountPercent = null
        if (originalPrice && originalPrice > price) {
          discountPercent = Math.round(((originalPrice - price) / originalPrice) * 100)
        }

        // Precio anterior, para evaluar alertas
        const { data: prevRow } = await supabaseAdmin
          .from('price_history')
          .select('price')
          .eq('item_id', item.id)
          .order('captured_at', { ascending: false })
          .limit(1)
          .maybeSingle<{ price: number }>()
        const previousPrice = prevRow ? Number(prevRow.price) : null

        // 3. Insertar el precio usando la función de deduplicación
        await supabaseAdmin.rpc('insert_price_if_changed', {
          p_item_id: item.id,
          p_price: price,
          p_original_price: originalPrice,
          p_currency: currency,
          p_discount_percent: discountPercent,
          p_price_type: originalPrice ? 'promotion' : 'standard',
          p_source: 'cron'
        })

        // Backfill de categoría: la mayoría del catálogo entró por la extensión
        // sin categoría, y sin eso no hay página de categoría ni enlazado
        // interno para ese producto.
        let categoryName: string | undefined
        if (!item.category_name && mlData.category_id) {
          const cat = await resolveRootCategory(mlData.category_id)
          if (cat) {
            categoryName = cat.rootName
            categorized++
          }
        }

        // Actualizar last_seen_at, resetear el contador de fallos y refrescar flags
        await supabaseAdmin
          .from('items')
          .update({
            last_seen_at: new Date().toISOString(),
            fetch_failures: 0,
            category_id: mlData.category_id ?? undefined,
            category_name: categoryName,
            free_shipping: mlData.free_shipping,
            shipping_mode: mlData.shipping_mode,
            condition: mlData.condition,
            seller_id: mlData.seller_id ?? undefined
          })
          .eq('id', item.id)

        // Siempre evaluamos alertas (el cooldown de 24h evita el spam de mails).
        processAlertsForItem(item.id, price, previousPrice).catch(err =>
          console.error('[Cron] Alert processing failed for item', item.id, err)
        )

        // Recalcular Deal Score después de cada actualización de precio
        const score = await computeAndStoreDealScore(item.id).catch(err => {
          console.error('[Cron] Deal score failed for item', item.id, err)
          return null
        })
        if (score) scored++

        updated++

        // Rate limit: ML tolera ~30 req/min en endpoints públicos.
        await new Promise(r => setTimeout(r, SLEEP_MS))

      } catch (err) {
        console.error(`[Cron] Error processing ${item.ml_item_id}:`, err)
        errors++
      }
    }

    return NextResponse.json({
      message: 'Cron completed',
      total: items.length,
      updated,
      scored,
      errors,
      deactivated,
      categorized,
      skippedUnresolvable,
      timestamp: new Date().toISOString()
    })

  } catch (err) {
    console.error('[Cron] Fatal error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
