/**
 * Diagnóstico del análisis de opiniones con IA.
 *
 * reviews_analysis está en 0 filas desde siempre y la home promete la feature.
 * Este script no arregla nada: prueba cada eslabón de la cadena por separado y
 * dice cuál se corta.
 *
 *   node scripts/diagnose-reviews.mjs
 *
 * Es de sólo lectura. No escribe en la base ni manda nada.
 */
import { loadEnv, pedir } from './lib-env.mjs'

const env = loadEnv([
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
  'ML_CLIENT_ID',
  'ML_CLIENT_SECRET'
])

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
const ES_CLAVE_NUEVA = KEY.startsWith('sb_')

// El modelo que usa lib/reviews.ts hoy.
const MODELO = 'claude-opus-4-7'

function titulo(t) {
  console.log(`\n${'─'.repeat(62)}\n${t}\n${'─'.repeat(62)}`)
}

async function sb(path) {
  const headers = { apikey: KEY, 'Content-Type': 'application/json' }
  if (!ES_CLAVE_NUEVA) headers.Authorization = `Bearer ${KEY}`
  const r = await pedir(`${SUPABASE_URL}/rest/v1/${path}`, { headers })
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${r.raw.slice(0, 200)}`)
  return r.body ?? []
}

// ---------- 1. token de ML ----------
titulo('1. Token de MercadoLibre')

const tokens = await sb('user_ml_tokens?select=user_id,access_token,refresh_token,expires_at&order=updated_at.desc&limit=1')
if (tokens.length === 0) {
  console.log('  ✗ No hay ningún token en user_ml_tokens. Sin token no se puede consultar nada.')
  process.exit(1)
}

let accessToken = tokens[0].access_token
const vence = new Date(tokens[0].expires_at)
console.log(`  Vence: ${vence.toISOString()} (${vence > new Date() ? 'vigente' : 'VENCIDO'})`)

if (vence <= new Date()) {
  console.log('  Refrescando...')
  const r = await pedir('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: env.ML_CLIENT_ID,
      client_secret: env.ML_CLIENT_SECRET,
      refresh_token: tokens[0].refresh_token
    })
  })
  if (!r.ok) {
    console.log(`  ✗ No se pudo refrescar: ${r.status} ${r.raw.slice(0, 200)}`)
    process.exit(1)
  }
  accessToken = r.body.access_token
  console.log('  ✓ Refrescado')
}

const ml = path =>
  pedir(`https://api.mercadolibre.com${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
  })

const yo = await ml('/users/me')
console.log(`  ${yo.ok ? '✓' : '✗'} /users/me → HTTP ${yo.status}`)
if (!yo.ok) {
  console.log(`    ${yo.raw.slice(0, 200)}`)
  process.exit(1)
}

// ---------- 2. el endpoint de reseñas, por tipo de ID ----------
titulo('2. Endpoint de reseñas, según el tipo de ID del producto')

const muestras = await sb(
  'items?select=ml_item_id,title,category_id&is_active=eq.true&order=id.desc&limit=400'
)

const clasificar = id => {
  if (/^[A-Z]{3}U\d+$/.test(id)) return 'up'
  return id.replace(/^[A-Z]{3}/, '').length >= 10 ? 'listing' : 'catalogo'
}

const porTipo = { listing: [], catalogo: [], up: [] }
for (const it of muestras) porTipo[clasificar(it.ml_item_id)].push(it)

const resumen = {}

for (const tipo of ['listing', 'catalogo', 'up']) {
  const grupo = porTipo[tipo].slice(0, 4)
  console.log(`\n  ${tipo.toUpperCase()} (${porTipo[tipo].length} en la muestra)`)
  if (grupo.length === 0) {
    console.log('    (ninguno en la muestra)')
    continue
  }
  resumen[tipo] = { probados: 0, ok: 0, conResenas: 0, statuses: {} }

  for (const it of grupo) {
    const r = await ml(`/reviews/item/${it.ml_item_id}?limit=50`)
    const total = r.body?.paging?.total ?? (r.body?.reviews?.length ?? 0)
    resumen[tipo].probados++
    resumen[tipo].statuses[r.status] = (resumen[tipo].statuses[r.status] ?? 0) + 1
    if (r.ok) {
      resumen[tipo].ok++
      if (total > 0) resumen[tipo].conResenas++
    }
    console.log(
      `    ${it.ml_item_id.padEnd(16)} HTTP ${r.status}` +
        (r.ok ? `  reseñas: ${total}` : `  ${(r.body?.message ?? r.raw).toString().slice(0, 70)}`)
    )
    await new Promise(s => setTimeout(s, 400))
  }
}

// Para catálogo, la doc pide catalog_product_id aparte. Probémoslo.
titulo('3. Catálogo con el parámetro catalog_product_id')
const cat = porTipo.catalogo.slice(0, 3)
for (const it of cat) {
  const r = await ml(`/reviews/item/${it.ml_item_id}?catalog_product_id=${it.ml_item_id}&limit=50`)
  const total = r.body?.paging?.total ?? (r.body?.reviews?.length ?? 0)
  console.log(
    `    ${it.ml_item_id.padEnd(16)} HTTP ${r.status}` +
      (r.ok ? `  reseñas: ${total}` : `  ${(r.body?.message ?? r.raw).toString().slice(0, 70)}`)
  )
  await new Promise(s => setTimeout(s, 400))
}

// ---------- 4. el modelo de Anthropic ----------
titulo('4. Modelo de Anthropic configurado en lib/reviews.ts')
console.log(`  MODEL = '${MODELO}'`)

const anth = await pedir('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    model: MODELO,
    max_tokens: 16,
    messages: [{ role: 'user', content: 'Respondé solamente: ok' }]
  })
})

if (anth.ok) {
  console.log(`  ✓ El modelo existe y responde (HTTP ${anth.status})`)
} else {
  console.log(`  ✗ HTTP ${anth.status} — ${(anth.body?.error?.message ?? anth.raw).toString().slice(0, 200)}`)
}

// Qué modelos hay disponibles con esta clave
const modelos = await pedir('https://api.anthropic.com/v1/models?limit=20', {
  headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }
})
if (modelos.ok) {
  console.log('\n  Modelos disponibles con tu clave:')
  for (const m of modelos.body?.data ?? []) console.log(`    ${m.id}`)
} else {
  console.log(`\n  No se pudo listar modelos: HTTP ${modelos.status}`)
}

// ---------- veredicto ----------
titulo('VEREDICTO')
for (const [tipo, r] of Object.entries(resumen)) {
  console.log(
    `  ${tipo.padEnd(9)} probados ${r.probados} · con respuesta OK ${r.ok} · con reseñas ${r.conResenas} · ` +
      `HTTP ${JSON.stringify(r.statuses)}`
  )
}
console.log(`  Anthropic: ${anth.ok ? 'OK' : 'FALLA — ' + (anth.body?.error?.type ?? anth.status)}`)
console.log('')
