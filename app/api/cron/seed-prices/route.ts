import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { processAlertsForItem } from '@/lib/alerts'
import { fetchMlInfoDetailed, type MlFetchDiag } from '@/lib/ml-fetch'
import { computeAndStoreDealScore } from '@/lib/deal-score'
import { resolveRootCategory } from '@/lib/ml-categories'

// Vercel Cron: corre cada 6 horas (configurado en vercel.json)
// Actualiza los precios de los items trackeados vía la API de ML.

export const maxDuration = 300 // 5 min, tope del plan Pro

/**
 * IDs que la API pública de ML NO resuelve: las páginas "user product" (/up/),
 * cuyo ID tiene una U extra después del prefijo de sitio (MLAU..., MLUU...).
 * Ni /items/{id} ni /products/{id} los aceptan.
 *
 * La exclusión vive AHORA EN LA CONSULTA (get_items_for_price_refresh). Antes
 * se filtraba acá, en memoria, después del LIMIT: como esos items nunca se
 * actualizan, se acumularon en la cabeza de la cola hasta que los 450 primeros
 * fueron todos /up/ y el cron empezó a devolver "No items to update" con 9.600
 * productos resolubles esperando detrás. Filtrar después del LIMIT fue el error.
 */

/** Fallos consecutivos tras los cuales damos el item de baja. */
const MAX_FETCH_FAILURES = 5

/**
 * Tamaño de lote y paralelismo.
 *
 * Antes: 150 items, uno por uno, con `await sleep(1200)` entre cada uno. Eso
 * son 180 de los 264 segundos que tardaba la corrida gastados en dormir, para
 * un trabajo real de ~0,56 s por item. A 150 items cada 6 horas, los 9.600
 * productos resolubles tardaban 16 DÍAS en completar una vuelta: un historial
 * de precios con datos de hace un mes no detecta ninguna promo inflada.
 *
 * Ahora: un pool de workers. El ritmo contra ML lo fija la concurrencia, no un
 * sleep fijo, y los dos valores son variables de entorno para poder bajarlos
 * sin deploy si ML empieza a devolver 429.
 */
// 600 items tardaron 74 s de los 240 s de presupuesto (17-nov). Subimos a 900,
// que con la llamada extra de categoría debería quedar en ~110-130 s. A 4
// corridas por día son 3.600 items/día: vuelta completa al catálogo resoluble
// en menos de 3 días, contra los 16 de la versión secuencial.
// 900 items tardaron 107 s de los 240 s de presupuesto (17-nov), sin un solo
// 429 en tres corridas seguidas. 1.500 deberían entrar en ~175 s. A 4 corridas
// por día son 6.000 items/día: vuelta completa al catálogo resoluble en menos
// de dos días, contra los 16 de la versión secuencial. El guard de 240 s está
// justamente para que una corrida lenta devuelva lo hecho en vez de que la
// corte Vercel.
const BATCH_SIZE = Number(process.env.CRON_BATCH_SIZE ?? 1500)
const CONCURRENCY = Number(process.env.CRON_CONCURRENCY ?? 6)

/**
 * Presupuesto propio, por debajo del maxDuration de 300 s. Al llegar acá
 * dejamos de tomar items nuevos y devolvemos lo hecho. Sin esto, una corrida
 * lenta la corta Vercel a los 300 s y se pierde hasta el informe de qué pasó.
 */
const TIME_BUDGET_MS = 240_000

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

  const startedAt = Date.now()

  try {
    // 1. Los items activos más desactualizados, ya sin los /up/ irresolubles.
    const { data: raw, error } = await supabaseAdmin.rpc('get_items_for_price_refresh', {
      p_limit: BATCH_SIZE
    })

    if (error) throw error

    const items = (raw as CronItem[] | null) ?? []

    if (items.length === 0) {
      return NextResponse.json({ message: 'No items to update', updated: 0 })
    }

    let updated = 0
    let scored = 0
    let errors = 0
    let deactivated = 0
    let categorized = 0

    /**
     * Diagnóstico de categorías. Hoy `categorized` da 0 corrida tras corrida y
     * la caché `ml_categories` está vacía, con 919 de 14.570 items
     * categorizados. Estos contadores dicen en qué paso se corta: si ML no
     * manda category_id, si lo manda y falla la resolución, o si los items que
     * toca el cron ya venían categorizados.
     */
    let catAlreadySet = 0
    let catNoIdFromMl = 0
    let catLookupFailed = 0
    let fromProduct = 0
    let fromItem = 0
    let catFromListing = 0

    /**
     * Qué devuelve cada endpoint de ML, agregado. La corrida del 17-nov dio
     * 140 errores sobre 600 (23%, contra 11% de la secuencial) y no había forma
     * de saber si eran items muertos o ML frenándonos por ritmo. La diferencia
     * importa: un 429 no es culpa del item y no tiene que sumarle un strike.
     */
    const statusCount: Record<string, number> = {}
    const bump = (endpoint: string, status: number | null) => {
      if (status === null) return
      const key = `${endpoint}:${status}`
      statusCount[key] = (statusCount[key] ?? 0) + 1
    }

    /**
     * Un fallo cuenta como strike sólo si ML dijo algo definitivo sobre el
     * item (404 no existe, 400 mal formado). Un 429, un 5xx o un timeout son
     * problemas nuestros o de ML, y sumarlos lleva a dar de baja items sanos:
     * con 5 strikes el item se desactiva, así que a este ritmo bastarían un par
     * de corridas con ML lento para perder medio catálogo.
     */
    const esFalloDefinitivo = (diag: MlFetchDiag) =>
      [400, 403, 404].includes(diag.productStatus ?? 0) ||
      (diag.productStatus === null && [400, 403, 404].includes(diag.itemStatus ?? 0))


    /**
     * Marca un fallo de fetch. Clave: también movemos last_seen_at para que el
     * item rote y no vuelva a encabezar la cola en la corrida siguiente.
     */
    async function registerFailure(item: CronItem, definitivo: boolean) {
      const patch: Record<string, unknown> = {
        // last_seen_at se mueve SIEMPRE, aunque no sumemos strike: es lo que
        // hace rotar la cola. Sin esto los items muertos vuelven a encabezarla
        // en cada corrida, que fue exactamente el bug de septiembre.
        last_seen_at: new Date().toISOString()
      }
      if (definitivo) {
        const failures = (item.fetch_failures ?? 0) + 1
        patch.fetch_failures = failures
        if (failures >= MAX_FETCH_FAILURES) {
          patch.is_active = false
          deactivated++
        }
      }
      await supabaseAdmin.from('items').update(patch).eq('id', item.id)
    }

    async function processItem(item: CronItem) {
      try {
        const { info: mlData, diag } = await fetchMlInfoDetailed(item.ml_item_id)
        bump('item', diag.itemStatus)
        bump('product', diag.productStatus)
        bump('listing', diag.listingStatus)

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
          await registerFailure(item, esFalloDefinitivo(diag))
          await evaluateWithStoredPrice()
          return
        }

        if (mlData.source === 'product') fromProduct++
        else fromItem++

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
          return
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
        if (item.category_name) {
          catAlreadySet++
        } else if (!mlData.category_id) {
          catNoIdFromMl++
        } else {
          const cat = await resolveRootCategory(mlData.category_id)
          if (cat) {
            categoryName = cat.rootName
            categorized++
            if (mlData.category_source === 'listing') catFromListing++
          } else {
            catLookupFailed++
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

        // Alertas: ahora SÍ esperamos. Antes era fire-and-forget y en serverless
        // la promesa se corta cuando la respuesta se devuelve. El cooldown de
        // 24 h sigue evitando el spam de mails.
        await processAlertsForItem(item.id, price, previousPrice).catch(err =>
          console.error('[Cron] Alert processing failed for item', item.id, err)
        )

        // Recalcular Deal Score después de cada actualización de precio
        const score = await computeAndStoreDealScore(item.id).catch(err => {
          console.error('[Cron] Deal score failed for item', item.id, err)
          return null
        })
        if (score) scored++

        updated++

      } catch (err) {
        console.error(`[Cron] Error processing ${item.ml_item_id}:`, err)
        errors++
      }
    }

    // 2. Pool de workers: CONCURRENCY items en vuelo, sin sleep entre medio.
    let cursor = 0
    let processed = 0
    let budgetExhausted = false

    async function worker() {
      for (;;) {
        if (Date.now() - startedAt > TIME_BUDGET_MS) {
          budgetExhausted = true
          return
        }
        const index = cursor++
        if (index >= items.length) return
        await processItem(items[index])
        processed++
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => worker())
    )

    return NextResponse.json({
      message: 'Cron completed',
      total: items.length,
      processed,
      updated,
      scored,
      errors,
      deactivated,
      categorized,
      budgetExhausted,
      concurrency: CONCURRENCY,
      elapsedMs: Date.now() - startedAt,
      categoryDiag: {
        alreadySet: catAlreadySet,
        noIdFromMl: catNoIdFromMl,
        lookupFailed: catLookupFailed,
        fromProduct,
        fromItem,
        fromListing: catFromListing
      },
      statusCount,
      timestamp: new Date().toISOString()
    })

  } catch (err) {
    console.error('[Cron] Fatal error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
