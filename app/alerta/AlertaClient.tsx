'use client'

import { useState } from 'react'

interface Props {
  itemId: number
  title: string
  thumbnailUrl: string | null
  permalink: string
  currency: string
  precioActual: number | null
  precioMinimo: number | null
  sugerido: number
  yaExiste: number | null
  email: string | null
}

function formatPrice(value: number, currency: string) {
  const locales: Record<string, string> = {
    ARS: 'es-AR', BRL: 'pt-BR', MXN: 'es-MX', CLP: 'es-CL',
    COP: 'es-CO', PEN: 'es-PE', UYU: 'es-UY', USD: 'en-US'
  }
  return new Intl.NumberFormat(locales[currency] ?? 'es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(value)
}

export default function AlertaClient(props: Props) {
  const [target, setTarget] = useState(String(props.sugerido || ''))
  const [estado, setEstado] = useState<'form' | 'enviando' | 'listo' | 'error'>('form')
  const [mensaje, setMensaje] = useState('')

  async function crear() {
    const valor = Number(target)
    if (!Number.isFinite(valor) || valor <= 0) {
      setMensaje('Poné un precio válido.')
      setEstado('error')
      return
    }
    setEstado('enviando')
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: props.itemId,
          target_price: valor,
          alert_type: 'below'
        })
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setMensaje(body.error ?? 'No pudimos crear la alerta.')
        setEstado('error')
        return
      }
      setEstado('listo')
    } catch {
      setMensaje('No pudimos crear la alerta. Probá de nuevo.')
      setEstado('error')
    }
  }

  if (estado === 'listo') {
    return (
      <main className="dashboard">
        <div className="container dashboard-container alerta-box">
          <h1>Listo, te avisamos</h1>
          <p>
            Cuando <strong>{props.title}</strong> baje de{' '}
            <strong>{formatPrice(Number(target), props.currency)}</strong> te
            mandamos un mail{props.email ? ` a ${props.email}` : ''}.
          </p>
          <p className="alerta-nota">
            Revisamos los precios varias veces por día. La alerta se manda una
            sola vez; después podés crear otra.
          </p>
          <p>
            <a href="/dashboard" className="nav-login">Ir a mi panel</a>
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="dashboard">
      <div className="container dashboard-container alerta-box">
        <h1>Avisame si baja</h1>

        <div className="alerta-producto">
          {props.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.thumbnailUrl} alt="" width={64} height={64} />
          ) : null}
          <div>
            <a href={props.permalink} target="_blank" rel="noopener noreferrer">
              {props.title}
            </a>
            <div className="alerta-precios">
              {props.precioActual != null && (
                <span>Ahora: <strong>{formatPrice(props.precioActual, props.currency)}</strong></span>
              )}
              {props.precioMinimo != null && (
                <span>Mínimo que vimos: <strong>{formatPrice(props.precioMinimo, props.currency)}</strong></span>
              )}
            </div>
          </div>
        </div>

        {props.yaExiste != null && (
          <p className="alerta-nota">
            Ya tenías una alerta en {formatPrice(props.yaExiste, props.currency)}.
            Si creás esta, reemplaza a la anterior.
          </p>
        )}

        <label className="alerta-label" htmlFor="target">
          Avisame cuando baje de
        </label>
        <input
          id="target"
          type="number"
          inputMode="numeric"
          min={1}
          value={target}
          onChange={e => setTarget(e.target.value)}
          className="alerta-input"
        />

        {estado === 'error' && <p className="alerta-error">{mensaje}</p>}

        <button
          onClick={crear}
          disabled={estado === 'enviando'}
          className="alerta-submit"
        >
          {estado === 'enviando' ? 'Creando…' : 'Crear alerta'}
        </button>

        <p className="alerta-nota">
          Te llega por mail{props.email ? ` a ${props.email}` : ''}. Podés
          cambiar la dirección desde tu panel.
        </p>
      </div>
    </main>
  )
}
