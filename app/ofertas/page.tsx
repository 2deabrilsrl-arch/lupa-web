import type { Metadata } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { formatPrice, flagForSite, countryNameForSite, SUPPORTED_SITES } from '@/lib/format'

export const metadata: Metadata = {
  title: 'Ofertas del día — Lupa Precios',
  description:
    'Las mejores ofertas en MercadoLibre detectadas hoy: mayores caídas de precio, productos en mínimos históricos y top Deal Scores.',
  alternates: { canonical: 'https://lupaprecios.com/ofertas' }
}

export const dynamic = 'force-dynamic'
export const revalidate = 600

interface DealRow {
  section: string
  item_id: number
  ml_item_id: string
  title: string
  thumbnail_url: string | null
  permalink: string | null
  site_id: string
  latest_price: number
  min_price: number
  max_price: number
  avg_price: number | null
  currency: string
  drop_pct: number
  deal_score: number | null
  category_name: string | null
}

interface CategoryCount {
  ml_category_id: string
  name: string
  site_id: string
  items_count: number
  on_sale_count: number
}

const SECTION_TITLES: Record<string, { emoji: string; title: string; sub: string }> = {
  biggest_drops: {
    emoji: '🔥',
    title: 'Mayores caídas de precio',
    sub: 'Productos que más bajaron desde su máximo histórico'
  },
  top_scores: {
    emoji: '🏆',
    title: 'Mejores Deal Scores',
    sub: 'Buen precio + buen vendedor + buenas reseñas'
  },
  at_historical_min: {
    emoji: '🟢',
    title: 'En mínimo histórico',
    sub: 'Hoy están en el precio más bajo desde que los trackeamos'
  },
  newly_tracked: {
    emoji: '🆕',
    title: 'Recién agregados al catálogo',
    sub: 'Best-sellers de MercadoLibre que estamos empezando a trackear — su historial se construye con cada cron'
  }
}

function badgeForDeal(d: DealRow): { text: string; cls: string } | null {
  if (d.deal_score && Number(d.deal_score) >= 9) return { text: 'Excelente', cls: 'badge-good' }
  if (d.section === 'at_historical_min') return { text: 'Mínimo histórico', cls: 'badge-good' }
  if (d.drop_pct >= 30) return { text: `-${Math.round(d.drop_pct)}%`, cls: 'badge-good' }
  if (d.drop_pct >= 15) return { text: `-${Math.round(d.drop_pct)}%`, cls: 'badge-neutral' }
  return null
}

function DealCard({ d }: { d: DealRow }) {
  const badge = badgeForDeal(d)
  const productPath = `/p/${d.ml_item_id}`
  const dropFromAvg =
    d.avg_price && d.latest_price < Number(d.avg_price)
      ? Math.round(((Number(d.avg_price) - d.latest_price) / Number(d.avg_price)) * 100)
      : null

  return (
    <a href={productPath} className="deal-card">
      {badge && <span className={`deal-badge ${badge.cls}`}>{badge.text}</span>}
      <div className="deal-card-img">
        {d.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.thumbnail_url} alt="" loading="lazy" />
        ) : (
          <div className="deal-card-img-empty" />
        )}
      </div>
      <div className="deal-card-body">
        <div className="deal-card-title">{d.title}</div>
        <div className="deal-card-prices">
          <div className="deal-card-current">{formatPrice(d.latest_price, d.currency)}</div>
          {dropFromAvg && dropFromAvg > 0 && (
            <div className="deal-card-vs">vs prom: −{dropFromAvg}%</div>
          )}
        </div>
        <div className="deal-card-meta">
          <span title={countryNameForSite(d.site_id)}>{flagForSite(d.site_id)}</span>
          {d.category_name && <span className="deal-card-cat">· {d.category_name}</span>}
          {d.deal_score && <span className="deal-card-score">· {Math.round(Number(d.deal_score))}/10</span>}
        </div>
      </div>
    </a>
  )
}

interface PageProps {
  searchParams: Promise<{ site?: string }>
}

export default async function OfertasPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const requestedSite = sp.site && (SUPPORTED_SITES as readonly string[]).includes(sp.site) ? sp.site : 'MLA'

  const { data: deals } = await supabaseAdmin.rpc('get_public_deals', {
    p_site_id: requestedSite,
    p_limit_per_section: 12
  })

  const dealsBySection = new Map<string, DealRow[]>()
  for (const d of (deals ?? []) as DealRow[]) {
    const list = dealsBySection.get(d.section) ?? []
    list.push(d)
    dealsBySection.set(d.section, list)
  }

  const { data: categoriesRaw } = await supabaseAdmin.rpc('get_categories_with_counts', {
    p_site_id: requestedSite
  })
  const categories = ((categoriesRaw ?? []) as CategoryCount[]).filter(c => c.items_count > 0)

  const totalDeals = (deals ?? []).length

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

      <main className="ofertas">
        <div className="container ofertas-container">
          <div className="ofertas-header">
            <h1>Ofertas del día</h1>
            <p>
              Las mejores oportunidades detectadas en MercadoLibre, filtradas por nuestro algoritmo.
            </p>
          </div>

          <div className="country-tabs" role="tablist">
            {(SUPPORTED_SITES as readonly string[]).map(site => {
              const active = site === requestedSite
              return (
                <a
                  key={site}
                  href={`/ofertas?site=${site}`}
                  className={`country-tab ${active ? 'country-tab-active' : ''}`}
                  role="tab"
                  aria-selected={active}
                >
                  <span className="country-tab-flag">{flagForSite(site)}</span>
                  <span className="country-tab-name">{countryNameForSite(site)}</span>
                </a>
              )
            })}
          </div>

          {totalDeals === 0 ? (
            <div className="ofertas-empty">
              <p>
                Estamos empezando a trackear productos en {countryNameForSite(requestedSite)}.
                Volvé en unos días para ver ofertas reales.
              </p>
              {requestedSite !== 'MLA' && (
                <p style={{ marginTop: 8 }}>
                  Mientras, mirá las ofertas en <a href="/ofertas?site=MLA">Argentina</a>.
                </p>
              )}
            </div>
          ) : (
            Object.entries(SECTION_TITLES).map(([key, info]) => {
              const items = dealsBySection.get(key) ?? []
              if (items.length === 0) return null
              return (
                <section key={key} className="deal-section">
                  <div className="deal-section-header">
                    <h2>
                      <span>{info.emoji}</span> {info.title}
                    </h2>
                    <p className="deal-section-sub">{info.sub}</p>
                  </div>
                  <div className="deal-grid">
                    {items.map(d => (
                      <DealCard key={`${key}-${d.item_id}`} d={d} />
                    ))}
                  </div>
                </section>
              )
            })
          )}

          {categories.length > 0 && (
            <section className="deal-section">
              <div className="deal-section-header">
                <h2>
                  <span>📂</span> Por categoría
                </h2>
                <p className="deal-section-sub">
                  {categories.length} categorías con productos trackeados en {countryNameForSite(requestedSite)}
                </p>
              </div>
              <div className="cat-chips">
                {categories.slice(0, 24).map(c => (
                  <div key={c.ml_category_id} className="cat-chip">
                    <span className="cat-chip-name">{c.name}</span>
                    <span className="cat-chip-count">{c.items_count}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <p className="ofertas-disclaimer">
            Lupa Precios es una herramienta independiente y no está afiliada, respaldada ni patrocinada
            por MercadoLibre S.R.L.
          </p>
        </div>
      </main>
    </>
  )
}
