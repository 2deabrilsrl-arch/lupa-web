import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { processAlertsForItem } from '@/lib/alerts'

/**
 * Lightweight alerts-only cron — processes pending alerts using stored prices.
 * No ML API calls. Runs in seconds even with thousands of items.
 */
export const maxDuration = 60

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: rows, error } = await supabaseAdmin
    .from('alerts')
    .select('item_id')
    .eq('is_active', true)
    .is('deleted_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const itemIds = [...new Set((rows ?? []).map(r => r.item_id))]
  let fired = 0
  let skipped = 0

  for (const itemId of itemIds) {
    const { data: latest } = await supabaseAdmin
      .from('price_history')
      .select('price')
      .eq('item_id', itemId)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ price: number }>()
    if (!latest) continue
    const result = await processAlertsForItem(itemId, Number(latest.price), null)
    fired += result.fired
    skipped += result.skipped
  }

  return NextResponse.json({
    message: 'Alerts processed',
    items_with_alerts: itemIds.length,
    fired,
    skipped,
    timestamp: new Date().toISOString()
  })
}
