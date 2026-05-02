'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="es">
      <body>
        <div
          style={{
            maxWidth: 480,
            margin: '80px auto',
            padding: '0 24px',
            textAlign: 'center',
            fontFamily: 'system-ui, sans-serif'
          }}
        >
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Algo salió mal</h1>
          <p style={{ color: '#666', marginBottom: 24 }}>
            Tuvimos un problema procesando tu solicitud. Ya nos llegó la alerta.
          </p>
          <a href="/" style={{ color: '#3483FA', fontWeight: 500, textDecoration: 'none' }}>
            ← Volver al inicio
          </a>
        </div>
      </body>
    </html>
  )
}
