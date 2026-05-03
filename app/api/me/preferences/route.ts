import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function PATCH(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { notification_email?: string | null; display_name?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}

  if (body.notification_email !== undefined) {
    const v = (body.notification_email ?? '').trim()
    if (v === '') {
      update.notification_email = null
    } else if (!EMAIL_RE.test(v)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    } else {
      update.notification_email = v
    }
  }

  if (body.display_name !== undefined) {
    const v = (body.display_name ?? '').trim()
    update.display_name = v === '' ? null : v.slice(0, 80)
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('users').update(update).eq('id', user.id)

  if (error) {
    console.error('[Preferences] Update failed', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, updated: update })
}
