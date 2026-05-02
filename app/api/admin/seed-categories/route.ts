import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { mlFetch } from '@/lib/ml-service'
import { SUPPORTED_SITES } from '@/lib/format'

/**
 * Bootstrap tracked_categories for each ML site by fetching /sites/{site}/categories.
 * Run once after schema migration to populate non-MLA sites.
 *
 * GET with Authorization: Bearer ${CRON_SECRET}
 */
export const maxDuration = 60

interface MlCategory {
  id: string
  name: string
}

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const siteParam = searchParams.get('site')
  const sites = siteParam ? [siteParam] : [...SUPPORTED_SITES]

  const summary: Record<string, { fetched: number; inserted: number; updated: number }> = {}

  for (const site of sites) {
    const res = await mlFetch(`/sites/${site}/categories`)
    if (!res.ok) {
      summary[site] = { fetched: 0, inserted: 0, updated: 0 }
      continue
    }

    const cats = (await res.json()) as MlCategory[]

    // Bulk upsert in a single query — much faster than serial calls
    const rows = cats.map(c => ({
      site_id: site,
      ml_category_id: c.id,
      name: c.name,
      priority: 5,
      is_active: true
    }))

    const { error: upErr, count } = await supabaseAdmin
      .from('tracked_categories')
      .upsert(rows, { onConflict: 'site_id,ml_category_id', count: 'exact' })

    if (upErr) {
      console.error('[Seed] Upsert failed', site, upErr)
      summary[site] = { fetched: cats.length, inserted: 0, updated: 0 }
      continue
    }

    summary[site] = { fetched: cats.length, inserted: count ?? rows.length, updated: 0 }
  }

  return NextResponse.json({
    message: 'Category seeding completed',
    summary,
    timestamp: new Date().toISOString()
  })
}
