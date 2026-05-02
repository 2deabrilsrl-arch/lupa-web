import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { extractMlItemId } from '@/lib/ml-url'
import { fetchMlInfo } from '@/lib/ml-fetch'
import PriceChart from './PriceChart'

interface ItemRow {
  id: number
  ml_item_id: string
  title: string
  thumbnail_url: string | null
  permalink: string | null
  site_id: string | null
}

interface PriceRow {
  price: number
  original_price: number | null
  discount_percent: number | null
  captured_at: string
}

interface ProductData {
  item: ItemRow
  history: PriceRow[]
  stats: {
    min: number
    max: number
    avg: number
    count: number
    latest: number
    latestAt: string
    currency: string
  } | null
  fakeDiscount: { detected: boolean; reason: string | null }
}

const fmtPrice = (n: number, currency = 'ARS') =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)

async function ensureItemTracked(mlItemId: string): Promise<ItemRow | null> {
  const { data: existing } = await supabaseAdmin
    .from('items')
    .select('id, ml_item_id, title, thumbnail_url, permalink, site_id')
    .eq('ml_item_id', mlItemId)
    .maybeSingle<ItemRow>()
  if (existing) return existing

  try {
    const ml = await fetchMlInfo(mlItemId)
    if (!ml) {
      console.warn('[/p] ML fetch failed (item & product both)', mlItemId)
      return null
    }

    const { data: created, error } = await supabaseAdmin
      .from('items')
      .upsert(
        {
          ml_item_id: ml.ml_id,
          title: ml.title,
          thumbnail_url: ml.thumbnail_url,
          permalink: ml.permalink,
          category_id: ml.category_id,
          seller_id: ml.seller_id,
          site_id: ml.site_id,
          is_active: true,
          last_seen_at: new Date().toISOString()
        },
        { onConflict: 'ml_item_id' }
      )
      .select('id, ml_item_id, title, thumbnail_url, permalink, site_id')
      .single<ItemRow>()

    if (error || !created) return null

    await supabaseAdmin.rpc('insert_price_if_changed', {
      p_item_id: created.id,
      p_price: ml.price,
      p_original_price: ml.original_price,
      p_currency: ml.currency,
      p_discount_percent: null,
      p_price_type: ml.original_price ? 'promotion' : 'standard',
      p_source: 'web_lookup'
    })

    return created
  } catch (err) {
    console.error('[/p] ensureItemTracked failed', mlItemId, err)
    return null
  }
}

async function loadProduct(mlItemId: string): Promise<ProductData | null> {
  const item = await ensureItemTracked(mlItemId)
  if (!item) return null

  const { data: rawHistory } = await supabaseAdmin.rpc('get_price_history', {
    p_ml_item_id: mlItemId,
    p_days: 90
  })
  const history = (rawHistory as PriceRow[] | null) ?? []

  let stats: ProductData['stats'] = null
  let fake: ProductData['fakeDiscount'] = { detected: false, reason: null }

  if (history.length > 0) {
    const prices = history.map(h => Number(h.price))
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
    const latest = history[0]
    stats = {
      min,
      max,
      avg,
      count: history.length,
      latest: Number(latest.price),
      latestAt: latest.captured_at,
      currency: 'ARS'
    }

    if (latest.original_price && Number(latest.original_price) > Number(latest.price)) {
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
      const last30 = history.filter(h => new Date(h.captured_at).getTime() >= cutoff)
      if (last30.length > 1) {
        const minLast30 = Math.min(...last30.map(h => Number(h.price)))
        if (minLast30 < Number(latest.original_price) * 0.95) {
          fake = {
            detected: true,
            reason:
              `El precio ya estuvo en ${fmtPrice(minLast30)} en los últimos 30 días — el "precio anterior" de ${fmtPrice(Number(latest.original_price))} parece inflado.`
          }
        }
      }
    }
  }

  return { item, history, stats, fakeDiscount: fake }
}

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: RouteContext): Promise<Metadata> {
  const { id } = await params
  const mlId = extractMlItemId(id)
  if (!mlId) return { title: 'Producto no encontrado — Lupa Precios' }

  const { data: item } = await supabaseAdmin
    .from('items')
    .select('title, thumbnail_url')
    .eq('ml_item_id', mlId)
    .maybeSingle<{ title: string; thumbnail_url: string | null }>()

  const title = item?.title
    ? `${item.title.slice(0, 70)} — Historial de precios | Lupa Precios`
    : 'Historial de precios — Lupa Precios'

  return {
    title,
    description: item?.title
      ? `Mirá el historial real de precios de "${item.title.slice(0, 100)}" en MercadoLibre. Detectá descuentos falsos.`
      : 'Historial de precios para productos de MercadoLibre.',
    alternates: { canonical: `https://lupaprecios.com/p/${mlId}` },
    openGraph: {
      title,
      images: item?.thumbnail_url ? [{ url: item.thumbnail_url }] : undefined
    }
  }
}

export default async function ProductPage({ params }: RouteContext) {
  const { id } = await params
  const mlId = extractMlItemId(id)
  if (!mlId) notFound()

  const data = await loadProduct(mlId)
  if (!data) notFound()

  const { item, history, stats, fakeDiscount } = data
  const productUrl = item.permalink ?? `https://www.mercadolibre.com.ar/p/${mlId}`

  let indicator: { cls: string; text: string } | null = null
  if (stats && history.length >= 2) {
    if (stats.latest <= stats.min * 1.05) {
      indicator = { cls: 'pp-ind-good', text: '🟢 Estás cerca del mínimo histórico' }
    } else if (stats.latest <= stats.avg) {
      indicator = { cls: 'pp-ind-good', text: '🟢 Por debajo del promedio — buen momento' }
    } else if (stats.latest <= stats.avg * 1.1) {
      indicator = { cls: 'pp-ind-neutral', text: '🟡 Cerca del promedio' }
    } else {
      indicator = { cls: 'pp-ind-bad', text: '🔴 Por encima del promedio — esperá' }
    }
  }

  return (
    <>
      <header className="site-header">
        <div className="container site-header-inner">
          <a href="/" className="site-brand">
            <img src="/favicon.png" alt="" width={28} height={28} />
            <span>Lupa Precios</span>
          </a>
          <nav className="site-nav">
            <a href="/api/auth/login" className="nav-login">Iniciar sesión</a>
          </nav>
        </div>
      </header>

      <main className="pp">
        <div className="container pp-container">
          <div className="pp-card">
            <div className="pp-product">
              {item.thumbnail_url ? (
                <img src={item.thumbnail_url} alt="" className="pp-thumb" />
              ) : (
                <div className="pp-thumb pp-thumb-empty" />
              )}
              <div className="pp-product-info">
                <h1 className="pp-title">{item.title}</h1>
                <a href={productUrl} target="_blank" rel="noopener" className="pp-permalink">
                  Ver en MercadoLibre →
                </a>
              </div>
            </div>

            {fakeDiscount.detected && (
              <div className="pp-fake">
                <span className="pp-fake-icon">⚠️</span>
                <div>
                  <strong>Descuento sospechoso</strong>
                  <p>{fakeDiscount.reason}</p>
                </div>
              </div>
            )}

            {stats ? (
              <>
                <div className="pp-current">
                  <span className="pp-current-label">Precio actual</span>
                  <span className="pp-current-value">{fmtPrice(stats.latest, stats.currency)}</span>
                </div>

                <PriceChart
                  history={history.map(h => ({ price: Number(h.price), captured_at: h.captured_at }))}
                />

                <div className="pp-stats">
                  <div className="pp-stat">
                    <div className="pp-stat-label">Mínimo 90d</div>
                    <div className="pp-stat-value pp-good">{fmtPrice(stats.min, stats.currency)}</div>
                  </div>
                  <div className="pp-stat">
                    <div className="pp-stat-label">Promedio</div>
                    <div className="pp-stat-value">{fmtPrice(stats.avg, stats.currency)}</div>
                  </div>
                  <div className="pp-stat">
                    <div className="pp-stat-label">Máximo 90d</div>
                    <div className="pp-stat-value pp-bad">{fmtPrice(stats.max, stats.currency)}</div>
                  </div>
                </div>

                {indicator && <div className={`pp-indicator ${indicator.cls}`}>{indicator.text}</div>}
                <p className="pp-meta">
                  Basado en {stats.count} {stats.count === 1 ? 'registro' : 'registros'} de los
                  últimos 90 días. Última actualización: {new Date(stats.latestAt).toLocaleString('es-AR')}.
                </p>
              </>
            ) : (
              <div className="pp-empty">
                <p className="pp-empty-title">Empezamos a trackear este producto recién</p>
                <p className="pp-empty-sub">
                  Volvé en unas horas y vas a ver el historial completo. Mientras tanto te
                  recomendamos instalar la extensión para que se actualice automáticamente cuando
                  navegás MercadoLibre.
                </p>
              </div>
            )}

            <div className="pp-cta-row">
              <a href={productUrl} target="_blank" rel="noopener" className="pp-cta">
                Ir al producto en MercadoLibre
              </a>
              <a href="https://chromewebstore.google.com/" target="_blank" rel="noopener" className="pp-cta-secondary">
                Instalar la extensión
              </a>
            </div>
          </div>

          <p className="pp-disclaimer">
            Lupa Precios es una herramienta independiente. No estamos afiliados a MercadoLibre.
            Los precios pueden tener pequeñas demoras respecto a MercadoLibre.
          </p>
        </div>
      </main>
    </>
  )
}
