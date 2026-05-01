'use client'
import { useState, useEffect } from 'react'

interface TrackedItem {
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

export default function Dashboard() {
  const [items, setItems] = useState<TrackedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    const res = await fetch(
      `${supabaseUrl}/rest/v1/rpc/get_dashboard_items`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseKey!,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_limit: 50 })
      }
    )
    if (res.ok) {
      const data = await res.json()
      setItems(data || [])
    }
    setLoading(false)
  }

  const filteredItems = items.filter(i =>
    i.title?.toLowerCase().includes(search.toLowerCase())
  )

  const formatPrice = (p: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(p)

  return (
    <div style={{ fontFamily: 'var(--font)', maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3483FA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Lupa Precios</h1>
        <span style={{ fontSize: 12, color: '#999', marginLeft: 'auto' }}>
          {items.length} productos trackeados
        </span>
      </div>

      <input
        type="text"
        placeholder="Buscar producto..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: '100%', padding: '12px 16px', fontSize: 15,
          border: '1px solid #E0E0E0', borderRadius: 8,
          marginBottom: 24, outline: 'none'
        }}
      />

      {loading ? (
        <p style={{ textAlign: 'center', color: '#999', padding: 40 }}>Cargando...</p>
      ) : filteredItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          <p style={{ fontSize: 16, marginBottom: 8 }}>No hay productos trackeados todavía</p>
          <p style={{ fontSize: 13 }}>Instalá la extensión y navegá por MercadoLibre para empezar</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filteredItems.map(item => (
            <a
              key={item.id}
              href={`https://www.mercadolibre.com.ar/p/${item.ml_item_id}`}
              target="_blank"
              rel="noopener"
              style={{
                display: 'grid', gridTemplateColumns: '60px 1fr auto',
                gap: 14, alignItems: 'center',
                padding: 16, border: '1px solid #EFEFEF',
                borderRadius: 10, textDecoration: 'none', color: 'inherit',
                transition: 'border-color 0.2s'
              }}
            >
              {item.thumbnail_url ? (
                <img src={item.thumbnail_url} alt="" width={60} height={60}
                  style={{ borderRadius: 6, objectFit: 'contain', background: '#F7F7F7' }} />
              ) : (
                <div style={{ width: 60, height: 60, background: '#F7F7F7', borderRadius: 6 }} />
              )}
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.3,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                  overflow: 'hidden' }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                  {item.price_count} registros · desde {new Date(item.first_seen).toLocaleDateString('es-AR')}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{formatPrice(item.latest_price)}</div>
                <div style={{ fontSize: 11, color: '#00A650' }}>
                  Min: {formatPrice(item.min_price)}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
