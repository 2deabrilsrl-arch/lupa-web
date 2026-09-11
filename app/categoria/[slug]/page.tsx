import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { formatPrice, flagForSite, countryNameForSite, SUPPORTED_SITES } from '@/lib/format'
import { BASE_URL, slugify } from '@/lib/seo'

export const revalidate = 3600

const PAGE_SIZE = 48

interface CategoryRow {
  category_name: string
  site_id: string
  items: number
}

interface CategoryItem {
  ml_item_id: string
  title: string
  thumbnail_url: string | null
  site_id: string
  latest_price: number | null
  min_price: number | null
  max_price: number | null
  currency: string | null
  puntos: number
}

/** El slug viene de category_name; hay que resolverlo de vuelta al nombre real. */
async function resolveCategory(slug: string): Promise<string | null> {
  const { data } = await supabaseAdmin.rpc('get_indexable_categories', { p_min_items: 5 })
  const rows = (data as CategoryRow[] | null) ?? []
  const match = rows.find(r => slugify(r.category_name) === slug)
  return match?.category_name ?? null
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const name = await resolveCategory(slug)
  if (!name) return { title: 'Categoría no encontrada — Lupa Precios' }

  return {
    title: `${name}: historial de precios en MercadoLibre | Lupa Precios`,
    description: `Seguimos la evolución del precio de los productos de ${name} en MercadoLibre. Mínimo, máximo y promedio de los últimos 90 días para saber si el descuento es real.`,
    alternates: { canonical: `${BASE_URL}/categoria/${slug}` },
    openGraph: {
      title: `${name} — Historial de precios`,
      url: `${BASE_URL}/categoria/${slug}`,
      type: 'website'
    }
  }
}

export default async function CategoriaPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ site?: string; page?: string }>
}) {
  const { slug } = await params
  const sp = await searchParams

  const name = await resolveCategory(slug)
  if (!name) notFound()

  const site =
    sp.site && (SUPPORTED_SITES as readonly string[]).includes(sp.site) ? sp.site : null
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)

  const { data } = await supabaseAdmin.rpc('get_category_items', {
    p_category_name: name,
    p_site_id: site,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
    p_exclude_ml_item_id: null
  })
  const items = (data as CategoryItem[] | null) ?? []

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Ofertas', item: `${BASE_URL}/ofertas` },
      {
        '@type': 'ListItem',
        position: 3,
        name,
        item: `${BASE_URL}/categoria/${slug}`
      }
    ]
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="site-header">
        <div className="container site-header-inner">
          <a href="/" className="site-brand">
            <img src="/favicon.png" alt="" width={28} height={28} />
            <span>Lupa Precios</span>
          </a>
          <nav className="site-nav">
            <a href="/ofertas" className="nav-link-secondary">Ofertas</a>
            <a href="/api/auth/login" className="nav-login">Iniciar sesión</a>
          </nav>
        </div>
      </header>

      <main className="pp">
        <div className="container pp-container">
          <nav className="pp-breadcrumb" aria-label="Ruta de navegación">
            <a href="/">Inicio</a>
            <span aria-hidden="true">›</span>
            <a href="/ofertas">Ofertas</a>
            <span aria-hidden="true">›</span>
            <span>{name}</span>
          </nav>

          <h1 className="cat-title">{name}: historial de precios</h1>
          <p className="cat-intro">
            Seguimos el precio de {items.length > 0 ? 'estos' : 'los'} productos de {name} en
            MercadoLibre y guardamos cada cambio. Entrá a cualquiera para ver su mínimo, su máximo y
            si el descuento que muestra hoy es real o si le inflaron el precio antes de la promo.
          </p>

          <div className="chart-tabs" role="tablist" style={{ marginBottom: 20 }}>
            <a
              href={`/categoria/${slug}`}
              className={`chart-tab ${!site ? 'chart-tab-active' : ''}`}
            >
              🌎 Todos
            </a>
            {SUPPORTED_SITES.map(s => (
              <a
                key={s}
                href={`/categoria/${slug}?site=${s}`}
                className={`chart-tab ${site === s ? 'chart-tab-active' : ''}`}
                title={countryNameForSite(s)}
              >
                {flagForSite(s)}
              </a>
            ))}
          </div>

          {items.length === 0 ? (
            <div className="pp-card">
              <p>Todavía no tenemos productos de esta categoría en ese país.</p>
            </div>
          ) : (
            <div className="home-deals-grid">
              {items.map(it => (
                <a key={it.ml_item_id} href={`/p/${it.ml_item_id}`} className="deal-card">
                  <div className="deal-card-img">
                    {it.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.thumbnail_url} alt="" loading="lazy" />
                    ) : (
                      <div className="deal-card-img-empty" />
                    )}
                  </div>
                  <div className="deal-card-body">
                    <div className="deal-card-title">{it.title}</div>
                    {it.latest_price != null && (
                      <div className="deal-card-prices">
                        <div className="deal-card-current">
                          {formatPrice(Number(it.latest_price), it.currency ?? 'ARS')}
                        </div>
                      </div>
                    )}
                    <div className="deal-card-meta">
                      <span title={countryNameForSite(it.site_id)}>{flagForSite(it.site_id)}</span>
                      {it.puntos >= 2 && (
                        <span className="deal-card-cat">· {it.puntos} registros</span>
                      )}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}

          <div className="cat-pager">
            {page > 1 && (
              <a href={`/categoria/${slug}?${site ? `site=${site}&` : ''}page=${page - 1}`}>
                ← Anterior
              </a>
            )}
            {items.length === PAGE_SIZE && (
              <a href={`/categoria/${slug}?${site ? `site=${site}&` : ''}page=${page + 1}`}>
                Siguiente →
              </a>
            )}
          </div>
        </div>
      </main>

      <footer className="footer">
        <div className="container">
          <p>
            © 2026 Lupa Precios — lupaprecios.com · <a href="/cambios">Novedades</a> ·{' '}
            <a href="/privacidad">Privacidad</a> · <a href="/terminos">Términos</a>
          </p>
        </div>
      </footer>
    </>
  )
}
