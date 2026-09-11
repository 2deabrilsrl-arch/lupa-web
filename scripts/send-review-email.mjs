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
  // Mismo cuidado que con Resend: un POST sin Prefer: return=representation
  // devuelve 201 con el cuerpo VACÍO, y hacerle .json() explota con
  // "Unexpected end of JSON input" — justo después de haber guardado bien.
  const raw = await res.text()
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// ---------- resend ----------
const FROM = 'Lupa Precios <hola@lupaprecios.com>'
const FROM_DOMAIN = 'lupaprecios.com'

/**
 * Leer SIEMPRE como texto y recién después intentar parsear. Si se hace
 * res.json() de una respuesta vacía (un 401 sin cuerpo, por ejemplo), explota
 * con "Unexpected end of JSON input" y el status real nunca se ve.
 */
async function resend(path, init = {}) {
  const res = await fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {})
    }
  })
  const raw = await res.text()
  let body = null
  try {
    body = raw ? JSON.parse(raw) : null
  } catch {
    /* no era JSON */
  }
  if (!res.ok) {
    const detalle = body ? JSON.stringify(body) : raw ? raw.slice(0, 300) : '(respuesta vacía)'
    throw new Error(`Resend HTTP ${res.status} — ${detalle}`)
  }
  return body
}

/** Antes de mandar nada: ¿la clave sirve y el dominio está verificado? */
async function preflight() {
  let dominios
  try {
    dominios = await resend('/domains')
  } catch (err) {
    throw new Error(
      `La RESEND_API_KEY de .env.local no funciona.\n\n  ${err.message}\n\n` +
      '  Igual que con Supabase, puede haber quedado vieja. Copiá la que está\n' +
      '  andando en producción: Vercel → lupa-web → Settings → Environment\n' +
      '  Variables → RESEND_API_KEY → el ojito → pegala en .env.local\n' +
      '  (o generá una nueva en resend.com/api-keys).'
    )
  }

  const lista = dominios?.data ?? []
  console.log('Dominios en Resend:')
  for (const d of lista) {
    console.log(`  ${d.name} — ${d.status}`)
  }

  const propio = lista.find(d => d.name === FROM_DOMAIN)
  if (!propio) {
    throw new Error(
      `El dominio ${FROM_DOMAIN} no figura en esta cuenta de Resend, así que no se\n` +
      `  puede mandar desde ${FROM}. Verificalo en resend.com/domains.`
    )
  }
  if (propio.status !== 'verified') {
    throw new Error(
      `El dominio ${FROM_DOMAIN} está en estado "${propio.status}", no "verified".\n` +
      '  Hasta que no esté verificado Resend rechaza los envíos.'
    )
  }
  console.log('')
}

async function send(to) {
  const body = await resend('/emails', {
    method: 'POST',
    body: JSON.stringify({
      from: FROM,
      to,
      reply_to: 'hola@lupaprecios.com',
      subject: SUBJECT,
      html: html(),
      text: text()
    })
  })
  return body?.id
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

console.log('')
await preflight()

console.log('Enviando...\n')
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
    // Si el primero falla, falla todo: cortamos en vez de repetir 24 veces
    // el mismo error y ensuciar la salida.
    if (ok === 0) {
      console.error('\n  Corto acá: el primer envío falló, no tiene sentido seguir.')
      break
    }
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
