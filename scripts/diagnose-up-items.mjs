/**
 * Los items /up/ (user product) son 4.945 de 14.542 — un 34% del catálogo — y
 * el cron de precios no los puede refrescar porque ni /items/{id} ni
 * /products/{id} los resuelven. Hoy sólo se actualizan cuando un usuario los
 * visita con la extensión.
 *
 * Pero sabemos que /reviews/item/MLAU... SÍ responde 200, así que la API
 * conoce estos IDs en algún contexto. Este script prueba varias formas de
 * endpoint a ver si alguna devuelve precio. Si alguna anda, recuperamos un
 * tercio del catálogo para el cron.
 *
 *   node scripts/diagnose-up-items.mjs
 *
 * Sólo lectura.
 */
import { loadEnv, pedir } from './lib-env.mjs'

const env = loadEnv([
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ML_CLIENT_ID',
  'ML_CLIENT_SECRET'
])

const KEY = env.SUPABASE_SERVICE_ROLE_KEY
const ES_NUEVA = KEY.startsWith('sb_')

async function sb(path) {
  const headers = { apikey: KEY, 'Content-Type': 'application/json' }
  if (!ES_NUEVA) headers.Authorization = `Bearer ${KEY}`
  const r = await pedir(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, { headers })
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${r.raw.slice(0, 200)}`)
  return r.body ?? []
}

const t = await sb('user_ml_tokens?select=access_token,refresh_token,expires_at&order=updated_at.desc&limit=1')
let token = t[0].access_token
if (new Date(t[0].expires_at) <= new Date()) {
  const r = await pedir('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: env.ML_CLIENT_ID,
      client_secret: env.ML_CLIENT_SECRET,
      refresh_token: t[0].refresh_token
    })
  })
  if (!r.ok) { console.log('No se pudo refrescar el token'); process.exit(1) }
  token = r.body.access_token
}

const ml = path =>
  pedir(`https://api.mercadolibre.com${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  })

// Tomamos items /up/ que la extensión visitó hace poco: sabemos que existen.
const muestra = await sb(
  'items?select=ml_item_id,permalink,site_id&is_active=eq.true&order=last_seen_at.desc&limit=300'
)
const ups = muestra.filter(i => /^[A-Z]{3}U\d+$/.test(i.ml_item_id)).slice(0, 3)

if (ups.length === 0) {
  console.log('No encontré items /up/ en la muestra.')
  process.exit(0)
}

/** Devuelve el primer precio que encuentre en una respuesta, mire donde mire. */
function buscarPrecio(obj, prof = 0) {
  if (!obj || prof > 4) return null
  if (Array.isArray(obj)) {
    for (const x of obj) { const p = buscarPrecio(x, prof + 1); if (p) return p }
    return null
  }
  if (typeof obj !== 'object') return null
  for (const k of ['price', 'amount', 'sale_price']) {
    const v = obj[k]
    if (typeof v === 'number' && v > 0) return v
    if (v && typeof v === 'object') { const p = buscarPrecio(v, prof + 1); if (p) return p }
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object') { const p = buscarPrecio(v, prof + 1); if (p) return p }
  }
  return null
}

for (const it of ups) {
  const id = it.ml_item_id
  const sinU = id.replace(/^([A-Z]{3})U/, '$1')
  console.log(`\n${'═'.repeat(60)}\n${id}   (${it.site_id})\n${it.permalink ?? ''}\n${'═'.repeat(60)}`)

  const variantes = [
    ['/items/{id}', `/items/${id}`],
    ['/products/{id}', `/products/${id}`],
    ['/products/{id}/items', `/products/${id}/items?limit=5`],
    ['/items/{id sin la U}', `/items/${sinU}`],
    ['/products/{id sin la U}', `/products/${sinU}`],
    ['/user-products/{id}', `/user-products/${id}`],
    ['/items?ids={id}', `/items?ids=${id}`],
    ['/reviews/item/{id}', `/reviews/item/${id}?limit=1`]
  ]

  for (const [nombre, path] of variantes) {
    const r = await ml(path)
    const precio = r.ok ? buscarPrecio(r.body) : null
    const extra = r.ok
      ? precio
        ? `  → PRECIO ${precio}`
        : '  (200 pero sin precio)'
      : `  ${(r.body?.message ?? r.raw).toString().slice(0, 60)}`
    console.log(`  ${r.ok ? '✓' : '✗'} ${nombre.padEnd(26)} HTTP ${String(r.status).padEnd(4)}${extra}`)
    await new Promise(s => setTimeout(s, 350))
  }
}

console.log('\nSi alguna variante devuelve precio, se puede sumar a fetchMlInfo')
console.log('y recuperar ~4.900 productos para el cron.\n')
