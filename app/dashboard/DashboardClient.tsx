'use client'
import { useMemo, useState } from 'react'

export interface TrackedItem {
  id: number
  ml_item_id: string
  title: string
  thumbnail_url: string
  latest_price: number
  min_price: number
  max_price: number
  price_count: number
  first_seen: string
}

export interface UserAlert {
  id: number
  target_price: number
  alert_type: string
  drop_percent: number | null
  created_at: string
  triggered_at: string | null
  item_id: number
  ml_item_id: string
  title: string
  thumbnail_url: string | null
  site_id: string | null
}

export interface UserPrefs {
  notification_email: string | null
  display_name: string | null
  ml_email: string | null
}

const formatPrice = (p: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(p)

type SortMode = 'recent' | 'price_asc' | 'price_desc' | 'biggest_drop' | 'near_min'

export default function DashboardClient({
  items,
  alerts: initialAlerts,
  prefs: initialPrefs
}: {
  items: TrackedItem[]
  alerts: UserAlert[]
  prefs: UserPrefs
}) {
  const [alerts, setAlerts] = useState<UserAlert[]>(initialAlerts)
  const [prefs, setPrefs] = useState<UserPrefs>(initialPrefs)
  const [showSettings, setShowSettings] = useState(false)
  const [notifEmail, setNotifEmail] = useState(initialPrefs.notification_email ?? '')
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [prefsMsg, setPrefsMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortMode>('recent')
  const [onlyDrops, setOnlyDrops] = useState(false)
  const [openAlertFor, setOpenAlertFor] = useState<number | null>(null)
  const [alertPrice, setAlertPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const filtered = useMemo(() => {
    let list = items.filter(i => i.title?.toLowerCase().includes(search.toLowerCase()))
    if (onlyDrops) {
      list = list.filter(i => Number(i.max_price) > Number(i.latest_price))
    }
    const dropPct = (i: TrackedItem) => {
      const max = Number(i.max_price)
      const latest = Number(i.latest_price)
      return max > 0 ? (max - latest) / max : 0
    }
    const distFromMin = (i: TrackedItem) => {
      const min = Number(i.min_price)
      const latest = Number(i.latest_price)
      return min > 0 ? (latest - min) / min : 999
    }
    switch (sort) {
      case 'price_asc':
        list = [...list].sort((a, b) => Number(a.latest_price) - Number(b.latest_price))
        break
      case 'price_desc':
        list = [...list].sort((a, b) => Number(b.latest_price) - Number(a.latest_price))
        break
      case 'biggest_drop':
        list = [...list].sort((a, b) => dropPct(b) - dropPct(a))
        break
      case 'near_min':
        list = [...list].sort((a, b) => distFromMin(a) - distFromMin(b))
        break
      // 'recent' = leave as-is (server returns newest first)
    }
    return list
  }, [items, search, sort, onlyDrops])

  async function submitAlert(itemId: number) {
    const target = parseInt(alertPrice.replace(/\D/g, ''), 10)
    if (!Number.isFinite(target) || target <= 0) {
      setFeedback({ kind: 'err', text: 'Ingresá un precio válido' })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, target_price: target, alert_type: 'below' })
      })
      const data = await res.json()
      if (!res.ok) {
        setFeedback({ kind: 'err', text: data.error || 'No pudimos crear la alerta' })
      } else {
        setFeedback({
          kind: 'ok',
          text: `Alerta creada. Te avisamos cuando baje a ${formatPrice(target)}.`
        })
        setOpenAlertFor(null)
        setAlertPrice('')
        setTimeout(() => location.reload(), 1500)
      }
    } catch {
      setFeedback({ kind: 'err', text: 'Error de red, probá de nuevo' })
    } finally {
      setSubmitting(false)
    }
  }

  async function cancelAlert(alertId: number) {
    if (!confirm('¿Cancelar esta alerta?')) return
    try {
      const res = await fetch(`/api/alerts?id=${alertId}`, { method: 'DELETE' })
      if (!res.ok) {
        setFeedback({ kind: 'err', text: 'No pudimos cancelar la alerta' })
        return
      }
      setAlerts(prev => prev.filter(a => a.id !== alertId))
      setFeedback({ kind: 'ok', text: 'Alerta cancelada' })
    } catch {
      setFeedback({ kind: 'err', text: 'Error de red' })
    }
  }

  async function savePrefs() {
    const value = notifEmail.trim()
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setPrefsMsg({ kind: 'err', text: 'Ingresá un email válido o dejá vacío' })
      return
    }
    setSavingPrefs(true)
    setPrefsMsg(null)
    try {
      const res = await fetch('/api/me/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_email: value || null })
      })
      const data = await res.json()
      if (!res.ok) {
        setPrefsMsg({ kind: 'err', text: data.error || 'No pudimos guardar' })
      } else {
        setPrefs(p => ({ ...p, notification_email: value || null }))
        setPrefsMsg({ kind: 'ok', text: 'Guardado. Las próximas alertas van a este email.' })
      }
    } catch {
      setPrefsMsg({ kind: 'err', text: 'Error de red' })
    } finally {
      setSavingPrefs(false)
    }
  }

  const effectiveEmail = prefs.notification_email || prefs.ml_email || '(sin email)'

  return (
    <>
      <details className="settings-card" open={showSettings}>
        <summary
          onClick={e => {
            e.preventDefault()
            setShowSettings(s => !s)
          }}
        >
          <span>⚙️ Configuración</span>
          <span className="settings-summary-meta">
            Email de alertas: <strong>{effectiveEmail}</strong>
          </span>
        </summary>
        <div className="settings-body">
          <label className="settings-label">
            Email para alertas de precio
            <input
              type="email"
              className="settings-input"
              placeholder={prefs.ml_email ?? 'tu@email.com'}
              value={notifEmail}
              onChange={e => setNotifEmail(e.target.value)}
            />
          </label>
          <p className="settings-hint">
            Si lo dejás vacío, te avisamos al email de tu cuenta de MercadoLibre
            ({prefs.ml_email ?? '—'}).
          </p>
          <button onClick={savePrefs} disabled={savingPrefs} className="settings-save">
            {savingPrefs ? 'Guardando...' : 'Guardar'}
          </button>
          {prefsMsg && (
            <p className={`settings-msg settings-msg-${prefsMsg.kind}`}>{prefsMsg.text}</p>
          )}
        </div>
      </details>

      {alerts.length > 0 && (
        <section className="alerts-section">
          <h2 className="alerts-section-title">🔔 Mis alertas activas ({alerts.length})</h2>
          <div className="alerts-list">
            {alerts.map(a => (
              <div key={a.id} className="alert-row">
                {a.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.thumbnail_url}
                    alt=""
                    width={40}
                    height={40}
                    className="alert-row-img"
                  />
                ) : (
                  <div className="alert-row-img alert-row-img-empty" />
                )}
                <div className="alert-row-text">
                  <a href={`/p/${a.ml_item_id}`} className="alert-row-title">
                    {a.title}
                  </a>
                  <div className="alert-row-meta">
                    Avisar cuando baje a <strong>{formatPrice(a.target_price)}</strong>
                    {a.triggered_at && (
                      <span className="alert-row-triggered">
                        {' '}· Disparada el {new Date(a.triggered_at).toLocaleDateString('es-AR')}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => cancelAlert(a.id)}
                  className="alert-row-cancel"
                  aria-label="Cancelar alerta"
                  title="Cancelar alerta"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <input
        type="text"
        placeholder="Buscar producto..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="dashboard-search"
      />

      <div className="dashboard-controls">
        <select
          className="dashboard-sort"
          value={sort}
          onChange={e => setSort(e.target.value as SortMode)}
          aria-label="Ordenar por"
        >
          <option value="recent">Más recientes</option>
          <option value="biggest_drop">Mayor caída de precio</option>
          <option value="near_min">Cerca del mínimo histórico</option>
          <option value="price_asc">Precio: menor a mayor</option>
          <option value="price_desc">Precio: mayor a menor</option>
        </select>
        <label className="dashboard-toggle">
          <input
            type="checkbox"
            checked={onlyDrops}
            onChange={e => setOnlyDrops(e.target.checked)}
          />
          Solo con baja de precio
        </label>
        <span style={{ fontSize: 12, color: '#999', marginLeft: 'auto' }}>
          {filtered.length} resultado{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      {feedback && (
        <div className={`alert-toast alert-toast-${feedback.kind}`}>{feedback.text}</div>
      )}

      {filtered.length === 0 ? (
        <div className="dashboard-empty">
          <p className="dashboard-empty-title">No hay productos para mostrar</p>
          <p className="dashboard-empty-sub">
            Instalá la extensión y navegá por MercadoLibre para empezar a trackear precios.
          </p>
        </div>
      ) : (
        <div className="dashboard-list">
          {filtered.map(item => {
            const productUrl = `https://www.mercadolibre.com.ar/p/${item.ml_item_id}`
            const isOpen = openAlertFor === item.id
            return (
              <div key={item.id} className="dashboard-item-wrap">
                <div className="dashboard-item">
                  {item.thumbnail_url ? (
                    <img src={item.thumbnail_url} alt="" className="dashboard-item-img" width={60} height={60} />
                  ) : (
                    <div className="dashboard-item-img dashboard-item-img-empty" />
                  )}
                  <a
                    href={productUrl}
                    target="_blank"
                    rel="noopener"
                    className="dashboard-item-text"
                  >
                    <div className="dashboard-item-title">{item.title}</div>
                    <div className="dashboard-item-meta">
                      {item.price_count} registros · desde {new Date(item.first_seen).toLocaleDateString('es-AR')}
                    </div>
                  </a>
                  <div className="dashboard-item-prices">
                    <div className="dashboard-item-current">{formatPrice(item.latest_price)}</div>
                    <div className="dashboard-item-min">Mín: {formatPrice(item.min_price)}</div>
                  </div>
                  <button
                    className="dashboard-item-alert-btn"
                    onClick={() => {
                      setFeedback(null)
                      setOpenAlertFor(isOpen ? null : item.id)
                      setAlertPrice('')
                    }}
                    aria-label="Crear alerta"
                  >
                    🔔
                  </button>
                </div>
                {isOpen && (
                  <div className="alert-form">
                    <label className="alert-form-label">
                      Avisame cuando baje a:
                    </label>
                    <div className="alert-form-row">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder={`Menos de ${formatPrice(item.latest_price)}`}
                        value={alertPrice}
                        onChange={e => setAlertPrice(e.target.value)}
                        className="alert-form-input"
                        autoFocus
                      />
                      <button
                        onClick={() => submitAlert(item.id)}
                        disabled={submitting}
                        className="alert-form-submit"
                      >
                        {submitting ? 'Creando...' : 'Crear alerta'}
                      </button>
                    </div>
                    <p className="alert-form-hint">
                      Te mandamos un email a la dirección con la que iniciaste sesión.
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
