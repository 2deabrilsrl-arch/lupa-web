import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'

interface CreatePayload {
  item_id: number
  target_price: number
  alert_type?: 'below' | 'drop_percent' | 'any_change'
  drop_percent?: number
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: CreatePayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const itemId = Number(body.item_id)
  const targetPrice = Number(body.target_price)
  const alertType = body.alert_type ?? 'below'

  if (!Number.isFinite(itemId) || itemId <= 0) {
    return NextResponse.json({ error: 'Invalid item_id' }, { status: 400 })
  }
  if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
    return NextResponse.json({ error: 'Invalid target_price' }, { status: 400 })
  }

  // Verify item exists
  const { data: item } = await supabaseAdmin
    .from('items')
    .select('id')
    .eq('id', itemId)
    .eq('is_active', true)
    .maybeSingle()

  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  // Avoid duplicates: deactivate any existing alert for the same user+item
  await supabaseAdmin
    .from('alerts')
    .update({ is_active: false })
    .eq('user_id', user.id)
    .eq('item_id', itemId)
    .eq('is_active', true)

  const { data, error } = await supabaseAdmin
    .from('alerts')
    .insert({
      user_id: user.id,
      item_id: itemId,
      target_price: targetPrice,
      alert_type: alertType,
      drop_percent: body.drop_percent ?? null,
      is_active: true
    })
    .select('id, target_price, alert_type, created_at')
    .single()

  if (error) {
    console.error('[Alerts] Insert failed', error)
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, alert: data })
}

export async function DELETE(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = Number(searchParams.get('id'))
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('alerts')
    .update({ is_active: false })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
