import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Novedades — Lupa Precios',
  description: 'Lo último que sumamos a Lupa Precios.',
  alternates: { canonical: 'https://lupaprecios.com/cambios' }
}

interface ChangelogEntry {
  date: string
  version: string
  changes: string[]
}

const ENTRIES: ChangelogEntry[] = [
  {
    date: '2 de mayo de 2026',
    version: 'v0.4.0',
    changes: [
      'Nueva: alertas de precio por email — pedinos que te avisemos cuando un producto baje al precio que querés pagar.',
      'Nueva: detector de descuentos falsos en el widget de la extensión.',
      'Nueva: el dashboard ahora muestra tus alertas activas y plan.',
      'Nueva: páginas de Privacidad y Términos publicadas.',
      'Mejora: sesiones firmadas con HMAC para mayor seguridad.',
      'Mejora: logout disponible desde el dashboard.'
    ]
  },
  {
    date: '1 de mayo de 2026',
    version: 'v0.3.0',
    changes: [
      'Nueva: extensión de Chrome que muestra el historial de precios en cualquier producto de MercadoLibre.',
      'Nueva: login con tu cuenta de MercadoLibre (PKCE).',
      'Nueva: backend público para registrar productos vistos por la extensión.'
    ]
  },
  {
    date: '1 de mayo de 2026',
    version: 'v0.2.0',
    changes: [
      'Nueva: dashboard privado con la lista de productos trackeados.',
      'Nueva: cron que actualiza precios cada 6 horas y refresca tokens cada 4 horas.'
    ]
  },
  {
    date: '1 de mayo de 2026',
    version: 'v0.1.0',
    changes: [
      'Lanzamiento privado: landing en lupaprecios.com con diseño y mensaje principales.'
    ]
  }
]

export default function CambiosPage() {
  return (
    <main className="legal">
      <div className="container legal-container">
        <h1>Novedades</h1>
        <p className="legal-meta">Todo lo que vamos sumando a Lupa Precios.</p>

        {ENTRIES.map(entry => (
          <section key={entry.version} style={{ marginBottom: 32 }}>
            <h2 style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span>{entry.version}</span>
              <span style={{ fontSize: 13, color: '#999', fontWeight: 400 }}>{entry.date}</span>
            </h2>
            <ul>
              {entry.changes.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </section>
        ))}

        <p style={{ marginTop: 32, fontSize: 14, color: '#666' }}>
          ¿Querés sugerir algo? Escribinos a{' '}
          <a href="mailto:hola@lupaprecios.com">hola@lupaprecios.com</a>.
        </p>

        <p style={{ marginTop: 24 }}>
          <a href="/">← Volver al inicio</a>
        </p>
      </div>
    </main>
  )
}
