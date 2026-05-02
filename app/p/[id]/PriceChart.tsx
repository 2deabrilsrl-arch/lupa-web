'use client'
import { useMemo, useState } from 'react'
import { formatPrice } from '@/lib/format'

interface Point {
  price: number
  captured_at: string
}

const HEIGHT = 160
const PAD_X = 8
const PAD_Y = 16

const RANGES = [
  { id: '7d', label: '7D', days: 7 },
  { id: '30d', label: '30D', days: 30 },
  { id: '90d', label: '90D', days: 90 },
  { id: '1y', label: '1A', days: 365 },
  { id: 'all', label: 'Todo', days: null }
] as const

type RangeId = (typeof RANGES)[number]['id']

export default function PriceChart({
  history,
  currency = 'ARS'
}: {
  history: Point[]
  currency?: string
}) {
  const [range, setRange] = useState<RangeId>('90d')

  const filtered = useMemo(() => {
    const cfg = RANGES.find(r => r.id === range)!
    if (cfg.days == null) return history
    const cutoff = Date.now() - cfg.days * 24 * 60 * 60 * 1000
    return history.filter(p => new Date(p.captured_at).getTime() >= cutoff)
  }, [history, range])

  // Filtered series (oldest → newest)
  const points = useMemo(() => [...filtered].reverse(), [filtered])

  const stats = useMemo(() => {
    if (points.length === 0) return null
    const prices = points.map(p => p.price)
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: prices.reduce((a, b) => a + b, 0) / prices.length,
      latest: prices[prices.length - 1],
      count: prices.length
    }
  }, [points])

  return (
    <>
      <div className="chart-tabs" role="tablist">
        {RANGES.map(r => (
          <button
            key={r.id}
            role="tab"
            aria-selected={range === r.id}
            className={`chart-tab ${range === r.id ? 'chart-tab-active' : ''}`}
            onClick={() => setRange(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {stats && stats.count >= 2 ? (
        <ChartSvg points={points} />
      ) : (
        <div className="pp-chart-empty">
          <p>
            {points.length === 0
              ? 'No hay datos en este período. Probá otro rango.'
              : 'Pocos registros aún — el gráfico aparece a partir del segundo precio recolectado.'}
          </p>
        </div>
      )}

      {stats && (
        <div className="chart-summary">
          <div className="chart-summary-row">
            <div className="chart-summary-cell">
              <div className="chart-summary-label">Mínimo</div>
              <div className="chart-summary-val chart-good">{formatPrice(stats.min, currency)}</div>
            </div>
            <div className="chart-summary-cell">
              <div className="chart-summary-label">Promedio</div>
              <div className="chart-summary-val">{formatPrice(stats.avg, currency)}</div>
            </div>
            <div className="chart-summary-cell">
              <div className="chart-summary-label">Máximo</div>
              <div className="chart-summary-val chart-bad">{formatPrice(stats.max, currency)}</div>
            </div>
            <div className="chart-summary-cell">
              <div className="chart-summary-label">Actual</div>
              <div className="chart-summary-val chart-current">{formatPrice(stats.latest, currency)}</div>
            </div>
          </div>
          <div className="chart-summary-meta">
            {stats.count} registro{stats.count !== 1 ? 's' : ''} en este rango
          </div>
        </div>
      )}
    </>
  )
}

function ChartSvg({ points }: { points: Point[] }) {
  const prices = points.map(p => p.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = Math.max(max - min, 1)

  const VB_W = 600
  const usableW = VB_W - PAD_X * 2
  const usableH = HEIGHT - PAD_Y * 2

  const stepX = usableW / Math.max(points.length - 1, 1)

  const path = points
    .map((p, i) => {
      const x = PAD_X + i * stepX
      const y = PAD_Y + (1 - (p.price - min) / range) * usableH
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

  const lastX = PAD_X + (points.length - 1) * stepX
  const lastY = PAD_Y + (1 - (points[points.length - 1].price - min) / range) * usableH

  const firstDate = new Date(points[0].captured_at).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short'
  })
  const lastDate = new Date(points[points.length - 1].captured_at).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short'
  })

  return (
    <div className="pp-chart-wrap">
      <svg
        className="pp-chart"
        viewBox={`0 0 ${VB_W} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Gráfico de evolución de precios"
      >
        <path
          d={`${path} L ${lastX.toFixed(1)} ${HEIGHT} L ${PAD_X} ${HEIGHT} Z`}
          fill="rgba(52,131,250,0.10)"
        />
        <path
          d={path}
          fill="none"
          stroke="#3483FA"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={lastX} cy={lastY} r="4" fill="#3483FA" />
      </svg>
      <div className="pp-chart-axis">
        <span>{firstDate}</span>
        <span>{lastDate}</span>
      </div>
    </div>
  )
}
