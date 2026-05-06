import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Lupa Precios — Historial de precios para MercadoLibre'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #F0F7FF 0%, #FFFFFF 60%, #FFFAE0 100%)',
          fontFamily: 'sans-serif',
          padding: 80
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 24,
            padding: '8px 20px',
            borderRadius: 999,
            background: '#E8F1FE',
            color: '#3483FA',
            fontSize: 22,
            fontWeight: 600
          }}
        >
          🔍 Lupa Precios
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 18,
            fontSize: 76,
            fontWeight: 800,
            letterSpacing: -2,
            color: '#1A1A1A',
            lineHeight: 1.05
          }}
        >
          <span>Conocé el</span>
          <span style={{ color: '#3483FA' }}>precio real</span>
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 76,
            fontWeight: 800,
            letterSpacing: -2,
            color: '#1A1A1A',
            lineHeight: 1.05,
            marginBottom: 32
          }}
        >
          en MercadoLibre
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 28,
            color: '#666',
            textAlign: 'center',
            maxWidth: 900
          }}
        >
          Historial de 90 días · Detector de descuentos falsos · Alertas de precio
        </div>
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            bottom: 48,
            fontSize: 22,
            color: '#999',
            fontWeight: 500
          }}
        >
          lupaprecios.com
        </div>
      </div>
    ),
    { ...size }
  )
}
