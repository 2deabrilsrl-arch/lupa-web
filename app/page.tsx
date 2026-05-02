import { supabaseAdmin } from '@/lib/supabase'
import { formatPrice, flagForSite } from '@/lib/format'

// TODO: replace with real Chrome Web Store URL once extension is published
const INSTALL_URL = 'https://chromewebstore.google.com/'

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
}

export default async function Home({
  searchParams
}: {
  searchParams: Promise<{ lookup_error?: string }>
}) {
  const { lookup_error } = await searchParams

  // Top deals for the homepage strip — pull biggest_drops only, top 8
  const { data: dealsRaw } = await supabaseAdmin.rpc('get_public_deals', {
    p_site_id: 'MLA',
    p_limit_per_section: 8
  })
  const homeDeals = ((dealsRaw ?? []) as DealRow[])
    .filter(d => d.section === 'biggest_drops')
    .slice(0, 8)
  return (
    <>
      {/* Header */}
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

      {/* Hero */}
      <section className="hero">
        <div className="container">
          <div className="hero-badge">Extensión gratuita para Chrome</div>
          <h1>
            Conocé el <span>precio real</span> de lo que comprás en MercadoLibre
          </h1>
          <p>
            Historial de precios, detector de descuentos falsos y análisis inteligente de opiniones.
            Dejá de pagar de más.
          </p>
          <a href={INSTALL_URL} target="_blank" rel="noopener" className="hero-cta">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Instalar Lupa Precios gratis
          </a>
          <p className="hero-sub">Chrome · Gratis · Sin registro · 2 segundos</p>

          <div className="lookup">
            <p className="lookup-label">¿En el celular? Pegá el link de un producto de MercadoLibre</p>
            <form action="/api/lookup" method="get" className="lookup-form">
              <input
                type="text"
                name="url"
                inputMode="url"
                placeholder="https://articulo.mercadolibre.com.ar/MLA-..."
                className="lookup-input"
                required
              />
              <button type="submit" className="lookup-submit">Ver historial</button>
            </form>
            {lookup_error && (
              <p className="lookup-error">No pudimos detectar un producto en ese link. Probá con un link directo a un producto.</p>
            )}
          </div>
        </div>
      </section>

      {/* Live deals strip */}
      {homeDeals.length > 0 && (
        <section className="home-deals">
          <div className="container">
            <div className="home-deals-header">
              <h2>🔥 Mejores ofertas detectadas hoy</h2>
              <a href="/ofertas" className="home-deals-link">
                Ver todas →
              </a>
            </div>
            <div className="home-deals-grid">
              {homeDeals.map(d => (
                <a key={d.item_id} href={`/p/${d.ml_item_id}`} className="deal-card">
                  {d.drop_pct >= 5 && (
                    <span className="deal-badge badge-good">−{Math.round(d.drop_pct)}%</span>
                  )}
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
                      <div className="deal-card-current">
                        {formatPrice(d.latest_price, d.currency)}
                      </div>
                    </div>
                    <div className="deal-card-meta">
                      <span>{flagForSite(d.site_id)}</span>
                      {d.deal_score && (
                        <span className="deal-card-score">
                          · {Math.round(Number(d.deal_score))}/10
                        </span>
                      )}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features */}
      <section className="features">
        <div className="container">
          <h2 className="features-title">Todo lo que necesitás para comprar inteligente</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📈</div>
              <h3>Historial de precios</h3>
              <p>Vemos cómo evolucionó el precio en los últimos 90 días. Sabé si hoy es buen momento para comprar o si conviene esperar.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🚨</div>
              <h3>Detector de descuentos falsos</h3>
              <p>Descubrí cuando un vendedor infla el precio antes del Hot Sale o Cyber Monday para simular un descuento mayor.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⭐</div>
              <h3>Análisis inteligente de opiniones</h3>
              <p>Resumen con IA de cientos de reseñas en segundos. Sabé qué dicen los compradores sin leer una por una.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔔</div>
              <h3>Alertas de precio</h3>
              <p>Configurá el precio que querés pagar y te avisamos por email cuando el producto llegue a ese valor.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🏆</div>
              <h3>Deal Score</h3>
              <p>Puntaje de 1 a 10 que combina precio histórico, reputación del vendedor, opiniones y envío. Sabé de un vistazo si es buena compra.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>Privado y seguro</h3>
              <p>No vendemos tus datos. No hacemos spam. La extensión funciona directamente en tu navegador. Sin registro obligatorio.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Demo de descuento falso */}
      <section className="demo-section">
        <div className="container">
          <h2 className="demo-title">¿Ese 40% OFF es real?</h2>
          <p className="demo-sub">
            Lupa analiza el historial y te dice la verdad que el vendedor no quiere que sepas.
          </p>
          <div className="demo-card">
            <div className="demo-alert">
              <span style={{fontSize: '20px'}}>⚠️</span>
              <div className="demo-alert-text">
                <strong>Descuento inflado detectado</strong>
                <span>El vendedor subió el precio 30% antes de la promo. Descuento real: 10%</span>
              </div>
            </div>
            <div className="demo-body">
              <div className="demo-stats">
                <div className="demo-stat">
                  <div className="demo-stat-label">Mínimo 90d</div>
                  <div className="demo-stat-val green">$89.990</div>
                </div>
                <div className="demo-stat">
                  <div className="demo-stat-label">Promedio</div>
                  <div className="demo-stat-val">$95.400</div>
                </div>
                <div className="demo-stat">
                  <div className="demo-stat-label">Máximo</div>
                  <div className="demo-stat-val red">$129.990</div>
                </div>
              </div>
              <div className="demo-indicator">
                🟢 Precio actual por debajo del promedio — buen momento para comprar
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="how">
        <div className="container">
          <h2 className="how-title">Funciona en 3 pasos</h2>
          <div className="how-steps">
            <div className="how-step">
              <div className="how-num">1</div>
              <h3>Instalá la extensión</h3>
              <p>Un click desde la Chrome Web Store. Sin registro, sin tarjeta.</p>
            </div>
            <div className="how-step">
              <div className="how-num">2</div>
              <h3>Navegá MercadoLibre</h3>
              <p>Buscá productos como siempre. Lupa trabaja automáticamente.</p>
            </div>
            <div className="how-step">
              <div className="how-num">3</div>
              <h3>Comprá informado</h3>
              <p>Vemos el historial, detectamos estafas y te decimos si es buen momento.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="cta-section" id="instalar">
        <div className="container">
          <h2>Dejá de pagar de más</h2>
          <p>Más de 1.000 productos ya están siendo trackeados. Sumate.</p>
          <a href={INSTALL_URL} target="_blank" rel="noopener" className="hero-cta">
            Instalar Lupa Precios gratis
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <p>
            © 2026 Lupa Precios — lupaprecios.com ·{' '}
            <a href="/cambios">Novedades</a> ·{' '}
            <a href="/privacidad">Privacidad</a> ·{' '}
            <a href="/terminos">Términos</a>
          </p>
          <p className="footer-disclaimer">
            Lupa Precios es una herramienta independiente y no está afiliada, respaldada ni patrocinada
            por MercadoLibre S.R.L. MercadoLibre es una marca registrada de MercadoLibre S.R.L.
          </p>
        </div>
      </footer>
    </>
  )
}
