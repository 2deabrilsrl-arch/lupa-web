// TODO: replace with real Chrome Web Store URL once extension is published
const INSTALL_URL = 'https://chromewebstore.google.com/'

export default function Home() {
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
        </div>
      </section>

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
