import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Lupa Precios',
    short_name: 'Lupa',
    description: 'Historial de precios y detector de descuentos falsos para MercadoLibre.',
    start_url: '/?utm_source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#3483FA',
    lang: 'es-AR',
    categories: ['shopping', 'utilities'],
    icons: [
      { src: '/favicon.png', sizes: '64x64 96x96 128x128 192x192', type: 'image/png', purpose: 'any' },
      { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
      { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  }
}
