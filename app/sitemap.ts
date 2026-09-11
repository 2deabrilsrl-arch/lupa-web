import type { MetadataRoute } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { BASE_URL, slugify } from '@/lib/seo'

/**
 * Sitemap completo en /sitemap.xml.
 *
 * Antes tenía 5 URLs estáticas: ninguna de las miles de fichas de producto
 * estaba declarada y Google las venía descubriendo por su cuenta.
 *
 * Nota: NO usamos generateSitemaps() a propósito. En la raíz, esa función
 * mueve todo a /sitemap/0.xml, /sitemap/1.xml… y deja /sitemap.xml en 404 —
 * justo la URL que ya está dada de alta en Search Console. Con ~2.000 URLs
 * estamos lejísimos del límite de 50.000 por archivo, así que un solo sitemap
 * es lo correcto. Si algún día nos acercamos, ahí sí se parte.
 */
export const revalidate = 3600

/** Tope defensivo, muy por debajo del límite de Google. */
const MAX_URLS = 45000

interface SitemapItem {
  ml_item_id: string
  last_price_at: string | null
}

interface CategoryRow {
  category_name: string
  site_id: string
  items: number
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticUrls: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/ofertas`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/cambios`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${BASE_URL}/privacidad`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/terminos`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 }
  ]

  // Categorías. El RPC devuelve una fila por categoría y país; la página
  // agrupa todos los países, así que deduplicamos por nombre.
  const { data: catsRaw } = await supabaseAdmin.rpc('get_indexable_categories', {
    p_min_items: 5
  })
  const seen = new Set<string>()
  const categoryUrls: MetadataRoute.Sitemap = []
  for (const c of (catsRaw as CategoryRow[] | null) ?? []) {
    const slug = slugify(c.category_name)
    if (!slug || seen.has(slug)) continue
    seen.add(slug)
    categoryUrls.push({
      url: `${BASE_URL}/categoria/${slug}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8
    })
  }

  // Fichas de producto con al menos 2 registros de precio. Con uno solo la
  // página no tiene historial que mostrar y declarar miles de páginas finas
  // juega en contra; esas van con noindex hasta que el cron les junte datos.
  const budget = MAX_URLS - staticUrls.length - categoryUrls.length
  const { data: itemsRaw } = await supabaseAdmin.rpc('get_indexable_items', {
    p_limit: budget,
    p_offset: 0
  })

  const productUrls: MetadataRoute.Sitemap = ((itemsRaw as SitemapItem[] | null) ?? []).map(i => ({
    url: `${BASE_URL}/p/${i.ml_item_id}`,
    lastModified: i.last_price_at ? new Date(i.last_price_at) : now,
    changeFrequency: 'daily' as const,
    priority: 0.7
  }))

  return [...staticUrls, ...categoryUrls, ...productUrls]
}
