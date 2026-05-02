import type { MetadataRoute } from 'next'

const BASE_URL = 'https://lupaprecios.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: BASE_URL, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/privacidad`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/terminos`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 }
  ]
}
