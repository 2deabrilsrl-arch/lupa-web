import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lupa Precios — Historial de precios para MercadoLibre',
  description: 'Extensión gratuita que te muestra el historial de precios de cualquier producto en MercadoLibre. Detectá descuentos falsos, compará precios y comprá al mejor momento.',
  keywords: 'historial de precios mercadolibre, comparar precios mercadolibre, descuentos falsos mercadolibre, ofertas reales, hot sale precios reales, cyber monday precios',
  openGraph: {
    title: 'Lupa Precios — Historial de precios para MercadoLibre',
    description: 'Descubrí el precio real de cualquier producto. Detectá descuentos falsos y comprá al mejor momento.',
    url: 'https://lupaprecios.com',
    siteName: 'Lupa Precios',
    locale: 'es_AR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lupa Precios — Historial de precios para MercadoLibre',
    description: 'Extensión gratuita para ver el historial de precios en MercadoLibre.',
  },
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://lupaprecios.com' }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
