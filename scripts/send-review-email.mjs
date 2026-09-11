/**
 * Mail puntual a los usuarios registrados pidiendo una reseña en la Chrome Web
 * Store. Arranca contando el bug del precio viejo: si le vas a pedir un favor a
 * alguien, primero le mostrás que estás laburando en serio.
 *
 * Corre desde TU máquina (necesita la RESEND_API_KEY de .env.local y salida a
 * internet).
 *
 *   node scripts/send-review-email.mjs            → prueba, no manda nada
 *   node scripts/send-review-email.mjs --send     → manda de verdad
 *
 * No repite: cada envío queda registrado en email_campaigns, así que si lo
 * corrés dos veces nadie recibe el mail dos veces.
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
import { SUBJECT, html, text } from './review-email-template.mjs'

const CAMPAIGN = 'reseña-chrome-store-2026-09'

// ---------- env ----------
function loadEnv() {
  const raw = readFileSync(resolve(ROOT, '.env.local'), 'utf8')
  const env = {}
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!m) continue
    env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }
  return env
}

const env = loadEnv()
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const RESEND_KEY = env.RESEND_API_KEY

for (const [k, v] of Object.entries({ SUPABASE_URL, SERVICE_KEY, RESEND_KEY })) {
  if (!v) {
    console.error(`Falta ${k} en .env.local`)
    process.exit(1)
  }
}

const SEND = process.argv.includes('--send')

// ---------- supabase ----------
/**
 * Las claves nuevas (sb_secret_...) van SÓLO en el header apikey; las viejas
 * (JWT service_role) van en apikey y en Authorization. Mandar una clave nueva
 * como Bearer no está soportado.
 */
const ES_CLAVE_NUEVA = SERVICE_KEY.startsWith('sb_')

async function sb(path, init = {}) {
  const headers = {
    apikey: SERVICE_KEY,
    'Content-Type': 'application/json',
    ...(init.headers ?? {})
  }
  if (!ES_CLAVE_NUEVA) headers.Authorization = `Bearer ${SERVICE_KEY}`

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers })

  if (!res.ok) {
    const body = await res.text()
    if (res.status === 401 && body.includes('Legacy API keys are disabled')) {
      throw new Error(
        'La SUPABASE_SERVICE_ROLE_KEY de tu .env.local es una clave vieja y Supabase ' +
        'las desactivó.\n\n' +
        '  Copiá la clave que YA está andando en producción:\n' +
        '  Vercel → proyecto lupa-web → Settings → Environment Variables →\n' +
        '  SUPABASE_SERVICE_ROLE_KEY → el ojito para verla → copiala a .env.local\n\n' +
        '  (Alternativa: Supabase → Settings → API Keys → pestaña "Publishable and\n' +
        '  secret API keys" → copiá la secret key, arranca con sb_secret_)'
      )
    }
    throw new Error(`Supabase ${res.status}: ${body}`)
  }
  return res.status === 204 ? null : res.json()
}

// ---------- resend ----------
async function send(to) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Lupa Precios <hola@lupaprecios.com>',
      to,
      reply_to: 'hola@lupaprecios.com',
      subject: SUBJECT,
      html: html(),
      text: text()
    })
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`Resend ${res.status}: ${JSON.stringify(body)}`)
  return body.id
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ---------- main ----------
async function main() {
const users = await sb('users?select=id,email,notification_email&deleted_at=is.null')
const yaEnviado = await sb(
  `email_campaigns?select=user_id&campaign=eq.${encodeURIComponent(CAMPAIGN)}`
)
const enviados = new Set(yaEnviado.map(r => r.user_id))

const destinatarios = users
  .map(u => ({ id: u.id, email: (u.notification_email || u.email || '').trim() }))
  .filter(u => u.email.includes('@'))
  .filter(u => !enviados.has(u.id))

console.log(`\nCampaña: ${CAMPAIGN}`)
console.log(`Asunto:  ${SUBJECT}`)
console.log(`Usuarios totales: ${users.length}`)
console.log(`Ya recibieron este mail: ${enviados.size}`)
console.log(`A enviar ahora: ${destinatarios.length}\n`)

for (const d of destinatarios) {
  console.log(`  ${d.email}`)
}

if (!SEND) {
  console.log('\n[PRUEBA] No se mandó nada. Volvé a correrlo con --send para enviar.\n')
  process.exit(0)
}

console.log('\nEnviando...\n')
let ok = 0
let fallaron = 0

for (const d of destinatarios) {
  try {
    const id = await send(d.email)
    await sb('email_campaigns', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify({
        user_id: d.id,
        campaign: CAMPAIGN,
        email: d.email,
        provider_id: id
      })
    })
    ok++
    console.log(`  ✓ ${d.email}`)
  } catch (err) {
    fallaron++
    console.error(`  ✗ ${d.email} — ${err.message}`)
  }
  // Resend limita a ~2 por segundo.
  await sleep(700)
}

console.log(`\nListo. Enviados: ${ok} · Fallaron: ${fallaron}\n`)
}

main().catch(err => {
  console.error(`\n${err.message}\n`)
  process.exit(1)
})
