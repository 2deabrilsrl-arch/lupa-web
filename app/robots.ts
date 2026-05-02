import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/p/'],
        disallow: ['/api/', '/dashboard', '/error']
      }
    ],
    sitemap: 'https://lupaprecios.com/sitemap.xml',
    host: 'https://lupaprecios.com'
  }
}
