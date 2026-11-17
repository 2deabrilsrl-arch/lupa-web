import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { aE164, reglaDe } from '@/lib/phone'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function PATCH(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    notification_email?: string | null
    display_name?: string | null
    whatsapp_phone?: string | null
    whatsapp_opt_in?: boolean
  }
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

  if (body.whatsapp_phone !== undefined) {
    const raw = (body.whatsapp_phone ?? '').trim()
    if (raw === '') {
      // Borrar el número es también retirar el consentimiento: no queda un
      // opt-in colgado sin número al que aplicarse.
      update.whatsapp_phone = null
      update.whatsapp_opt_in_at = null
      update.whatsapp_verified_at = null
    } else {
      // El país sale del sitio de ML que el usuario eligió en el panel, no de
      // una suposición: menos de la mitad del catálogo es argentino.
      // La cookie es la fuente más fresca; si no está (otro navegador, otro
      // dispositivo), usamos el país guardado en la cuenta.
      let site = (await cookies()).get('lupa_site')?.value
      if (!site) {
        const { data: fila } = await supabaseAdmin
          .from('users')
          .select('site_id')
          .eq('id', user.id)
          .maybeSingle<{ site_id: string | null }>()
        site = fila?.site_id ?? undefined
      }
      const e164 = aE164(raw, site)
      if (!e164) {
        const regla = reglaDe(site)
        return NextResponse.json(
          {
            error: `Teléfono inválido. Poné código de área y número (ej. ${regla.ejemplo}), ` +
                   `o escribilo completo con el código de país (+${regla.codigo}...).`
          },
          { status: 400 }
        )
      }
      update.whatsapp_phone = e164
      // Si cambia el número, lo verificado antes ya no vale para el nuevo.
      update.whatsapp_verified_at = null
    }
  }

  if (body.whatsapp_opt_in !== undefined) {
    if (body.whatsapp_opt_in) {
      update.whatsapp_opt_in_at = new Date().toISOString()
      update.whatsapp_opt_out_at = null
    } else {
      update.whatsapp_opt_in_at = null
      update.whatsapp_opt_out_at = new Date().toISOString()
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('users').update(update).eq('id', user.id)

  if (error) {
    console.error('[Preferences] Update failed', error)
    // El índice único de whatsapp_phone: el mismo número no puede quedar en
    // dos cuentas, porque entonces una baja no frenaría los mensajes.
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Ese teléfono ya está en otra cuenta.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, updated: update })
}
