import { Resend } from 'resend'

const FROM_ALERTS = 'Lupa Precios <alertas@lupaprecios.com>'
const FROM_HELLO = 'Lupa Precios <hola@lupaprecios.com>'
const REPLY_TO = 'hola@lupaprecios.com'

let _resend: Resend | null = null
function client(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured')
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

const fmtPrice = (n: number, currency = 'ARS') =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)

export interface PriceAlertEmail {
  to: string
  userName?: string | null
  productTitle: string
  productUrl: string
  thumbnailUrl?: string | null
  currentPrice: number
  targetPrice: number
  minPrice: number
  currency?: string
}

export async function sendPriceAlert(p: PriceAlertEmail) {
  const greeting = p.userName ? `Hola ${p.userName}` : '¡Hola!'
  const dropPercent = Math.max(
    0,
    Math.round(((p.targetPrice - p.currentPrice) / p.targetPrice) * 100)
  )
  const subject = `🎯 ${p.productTitle.slice(0, 70)} bajó a ${fmtPrice(p.currentPrice, p.currency)}`

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <div style="padding:20px 24px;background:linear-gradient(180deg,#F0F7FF 0%,#fff 100%);border-bottom:1px solid #efefef;">
        <div style="font-size:13px;color:#3483FA;font-weight:600;margin-bottom:4px;">🔍 Lupa Precios</div>
        <div style="font-size:20px;font-weight:700;">${greeting}, tu alerta de precio se disparó</div>
      </div>
      <div style="padding:24px;">
        ${
          p.thumbnailUrl
            ? `<div style="text-align:center;margin-bottom:16px;"><img src="${p.thumbnailUrl}" alt="" width="120" style="border-radius:8px;background:#f7f7f7;" /></div>`
            : ''
        }
        <div style="font-size:15px;font-weight:500;line-height:1.4;margin-bottom:16px;text-align:center;">${p.productTitle}</div>
        <div style="text-align:center;padding:16px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;margin-bottom:16px;">
          <div style="font-size:11px;color:#166534;text-transform:uppercase;letter-spacing:0.04em;">Precio actual</div>
          <div style="font-size:28px;font-weight:700;color:#166534;">${fmtPrice(p.currentPrice, p.currency)}</div>
          ${
            dropPercent > 0
              ? `<div style="font-size:13px;color:#166534;margin-top:4px;">${dropPercent}% por debajo de tu precio objetivo (${fmtPrice(p.targetPrice, p.currency)})</div>`
              : ''
          }
        </div>
        <div style="display:flex;gap:8px;font-size:12px;color:#666;justify-content:center;margin-bottom:20px;">
          <span>Mínimo histórico: <strong>${fmtPrice(p.minPrice, p.currency)}</strong></span>
        </div>
        <div style="text-align:center;">
          <a href="${p.productUrl}" style="display:inline-block;padding:12px 28px;background:#3483FA;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">Ir al producto</a>
        </div>
      </div>
      <div style="padding:16px 24px;border-top:1px solid #f7f7f7;font-size:11px;color:#999;text-align:center;">
        Recibís este email porque tenés una alerta activa en Lupa Precios.<br/>
        <a href="https://lupaprecios.com/dashboard" style="color:#3483FA;text-decoration:none;">Gestionar mis alertas</a> ·
        <a href="https://lupaprecios.com/privacidad" style="color:#3483FA;text-decoration:none;">Privacidad</a>
      </div>
    </div>
    <p style="font-size:11px;color:#bbb;text-align:center;margin-top:16px;">Lupa Precios es una herramienta independiente. No estamos afiliados a MercadoLibre.</p>
  </div>
</body>
</html>`

  const text = [
    `${greeting}, tu alerta de precio se disparó.`,
    '',
    p.productTitle,
    `Precio actual: ${fmtPrice(p.currentPrice, p.currency)}`,
    `Tu precio objetivo: ${fmtPrice(p.targetPrice, p.currency)}`,
    `Mínimo histórico: ${fmtPrice(p.minPrice, p.currency)}`,
    '',
    `Ver el producto: ${p.productUrl}`,
    '',
    'Gestionar tus alertas: https://lupaprecios.com/dashboard'
  ].join('\n')

  const { data, error } = await client().emails.send({
    from: FROM_ALERTS,
    to: p.to,
    replyTo: REPLY_TO,
    subject,
    html,
    text
  })

  if (error) {
    console.error('[Email] sendPriceAlert failed', error)
    throw error
  }
  return data
}

export async function sendWelcomeEmail({ to, userName }: { to: string; userName?: string | null }) {
  const greeting = userName ? `Hola ${userName}` : '¡Hola!'

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <div style="padding:28px 24px;background:linear-gradient(180deg,#F0F7FF 0%,#fff 100%);text-align:center;">
        <div style="font-size:32px;margin-bottom:8px;">🔍</div>
        <div style="font-size:22px;font-weight:700;">Bienvenida a Lupa Precios</div>
      </div>
      <div style="padding:24px;">
        <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">${greeting},</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
          Gracias por entrar a <strong>Lupa Precios</strong>. Estás entre las primeras personas en usar la app
          — tu feedback nos sirve un montón.
        </p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">Acá te dejo todo lo que podés hacer ya:</p>

        <div style="background:#f7f7f7;border-radius:8px;padding:16px;margin-bottom:20px;">
          <div style="font-size:14px;font-weight:600;margin-bottom:8px;">📈 Trackeá precios</div>
          <div style="font-size:13px;color:#666;line-height:1.5;">Instalá la extensión y andá a cualquier producto en MercadoLibre — vas a ver el historial automáticamente.</div>
        </div>
        <div style="background:#f7f7f7;border-radius:8px;padding:16px;margin-bottom:20px;">
          <div style="font-size:14px;font-weight:600;margin-bottom:8px;">🚨 Detectá descuentos falsos</div>
          <div style="font-size:13px;color:#666;line-height:1.5;">Te avisamos cuando un vendedor infló el precio antes de marcarlo "en oferta".</div>
        </div>
        <div style="background:#f7f7f7;border-radius:8px;padding:16px;margin-bottom:24px;">
          <div style="font-size:14px;font-weight:600;margin-bottom:8px;">🔔 Configurá alertas</div>
          <div style="font-size:13px;color:#666;line-height:1.5;">Decinos cuánto querés pagar por un producto y te mandamos un email cuando baje a ese precio.</div>
        </div>

        <div style="text-align:center;margin-bottom:20px;">
          <a href="https://lupaprecios.com/dashboard" style="display:inline-block;padding:12px 28px;background:#3483FA;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">Ir a mi panel</a>
        </div>

        <hr style="border:none;border-top:1px solid #efefef;margin:24px 0;" />

        <p style="font-size:14px;line-height:1.6;margin:0 0 12px;"><strong>¿Te puedo pedir un favor?</strong></p>
        <p style="font-size:14px;line-height:1.6;margin:0 0 8px;">Después de probarla un par de días, contestame este mismo email con:</p>
        <ul style="font-size:14px;line-height:1.6;color:#444;padding-left:20px;margin:0 0 16px;">
          <li>¿Qué te resultó útil?</li>
          <li>¿Qué te faltó o te confundió?</li>
          <li>¿Qué le agregarías?</li>
        </ul>
        <p style="font-size:14px;line-height:1.6;margin:0;">Te leo todas y respondo personalmente. ¡Gracias por sumarte!</p>
      </div>
      <div style="padding:16px 24px;border-top:1px solid #f7f7f7;font-size:11px;color:#999;text-align:center;">
        <a href="https://lupaprecios.com" style="color:#3483FA;text-decoration:none;">lupaprecios.com</a> ·
        <a href="https://lupaprecios.com/privacidad" style="color:#3483FA;text-decoration:none;">Privacidad</a> ·
        <a href="https://lupaprecios.com/terminos" style="color:#3483FA;text-decoration:none;">Términos</a>
      </div>
    </div>
  </div>
</body>
</html>`

  const text = [
    `${greeting},`,
    '',
    'Gracias por entrar a Lupa Precios. Estás entre las primeras personas en usar la app.',
    '',
    'Lo que podés hacer ya:',
    '- Trackear precios: instalá la extensión y navegá MercadoLibre',
    '- Detectar descuentos falsos: te avisamos cuando un vendedor infla precios',
    '- Configurar alertas: te mandamos email cuando un producto baja a tu precio objetivo',
    '',
    'Tu panel: https://lupaprecios.com/dashboard',
    '',
    '¿Te puedo pedir un favor? Contestame este email con:',
    '- ¿Qué te resultó útil?',
    '- ¿Qué te faltó o te confundió?',
    '- ¿Qué le agregarías?',
    '',
    '¡Gracias por sumarte!'
  ].join('\n')

  const { data, error } = await client().emails.send({
    from: FROM_HELLO,
    to,
    replyTo: REPLY_TO,
    subject: '👋 Bienvenida a Lupa Precios',
    html,
    text
  })

  if (error) {
    console.error('[Email] sendWelcomeEmail failed', error)
    throw error
  }
  return data
}

export async function notifyAdminNewSignup(p: {
  userId: string
  email: string | null
  nickname: string | null
  mlUserId: number
}) {
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) return

  const subject = `🎉 Nuevo usuario: ${p.nickname ?? p.email ?? p.userId}`
  const text = [
    'Nuevo usuario registrado en Lupa Precios:',
    '',
    `Nickname ML: ${p.nickname ?? '-'}`,
    `Email: ${p.email ?? '-'}`,
    `ML user ID: ${p.mlUserId}`,
    `Lupa user ID: ${p.userId}`,
    `Fecha: ${new Date().toISOString()}`,
    '',
    `Ver en Supabase: https://supabase.com/dashboard/project/hzmbhabxkglwsjbuszrm/editor`
  ].join('\n')

  const { error } = await client().emails.send({
    from: FROM_HELLO,
    to: adminEmail,
    subject,
    text
  })

  if (error) console.error('[Email] notifyAdminNewSignup failed', error)
}

