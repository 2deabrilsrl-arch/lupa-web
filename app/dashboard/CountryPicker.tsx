'use client'
import { ML_SITES } from '@/lib/ml-url'

/**
 * First-visit country picker styled like mercadolibre.com's country gateway.
 * Clicking a country writes the `lupa_site` cookie and reloads into the
 * dashboard for that site. Subsequent visits skip this screen entirely.
 */
export default function CountryPicker() {
  const choose = (siteId: string) => {
    // 1 year persistence
    document.cookie = `lupa_site=${siteId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
    window.location.href = `/dashboard?site=${siteId}`
  }

  return (
    <div className="country-picker">
      <h1 className="country-picker-title">¿Desde qué país comprás?</h1>
      <p className="country-picker-sub">
        Elegí tu país para ver los productos que estás trackeando. Podés cambiarlo
        después desde el panel.
      </p>
      <div className="country-picker-grid">
        {ML_SITES.map(s => (
          <button
            key={s.id}
            type="button"
            className="country-picker-item"
            onClick={() => choose(s.id)}
          >
            <span className="country-picker-flag" aria-hidden="true">{s.flag}</span>
            <span className="country-picker-label">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
