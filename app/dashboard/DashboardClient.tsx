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

const formatPrice = (p: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(p)

export default function DashboardClient({ items }: { items: TrackedItem[] }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(
    () => items.filter(i => i.title?.toLowerCase().includes(search.toLowerCase())),
    [items, search]
  )

  return (
    <>
      <input
        type="text"
        placeholder="Buscar producto..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="dashboard-search"
      />

      {filtered.length === 0 ? (
        <div className="dashboard-empty">
          <p className="dashboard-empty-title">No hay productos para mostrar</p>
          <p className="dashboard-empty-sub">
            Instalá la extensión y navegá por MercadoLibre para empezar a trackear precios.
          </p>
        </div>
      ) : (
        <div className="dashboard-list">
          {filtered.map(item => (
            <a
              key={item.id}
              href={`https://www.mercadolibre.com.ar/p/${item.ml_item_id}`}
              target="_blank"
              rel="noopener"
              className="dashboard-item"
            >
              {item.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.thumbnail_url} alt="" className="dashboard-item-img" width={60} height={60} />
              ) : (
                <div className="dashboard-item-img dashboard-item-img-empty" />
              )}
              <div>
                <div className="dashboard-item-title">{item.title}</div>
                <div className="dashboard-item-meta">
                  {item.price_count} registros · desde {new Date(item.first_seen).toLocaleDateString('es-AR')}
                </div>
              </div>
              <div className="dashboard-item-prices">
                <div className="dashboard-item-current">{formatPrice(item.latest_price)}</div>
                <div className="dashboard-item-min">Mín: {formatPrice(item.min_price)}</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </>
  )
}
