interface Point {
  price: number
  captured_at: string
}

const HEIGHT = 140
const PAD_X = 8
const PAD_Y = 12

export default function PriceChart({ history }: { history: Point[] }) {
  if (history.length < 2) {
    return (
      <div className="pp-chart-empty">
        <p>Pocos registros aún — el gráfico aparece a partir del segundo precio recolectado.</p>
      </div>
    )
  }

  const points = [...history].reverse() // oldest → newest
  const prices = points.map(p => p.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = Math.max(max - min, 1)

  // Use viewBox so it scales fluidly to container width
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
