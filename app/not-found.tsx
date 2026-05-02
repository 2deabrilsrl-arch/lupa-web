import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Página no encontrada — Lupa Precios',
  robots: { index: false, follow: false }
}

export default function NotFound() {
  return (
    <main className="not-found">
      <div className="container">
        <div className="not-found-icon">🔍</div>
        <h1>404</h1>
        <p>No encontramos lo que buscabas.</p>
        <a href="/" className="hero-cta">Volver al inicio</a>
      </div>
    </main>
  )
}
