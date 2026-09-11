/**
 * Segunda vuelta del diagnóstico. La primera descartó el modelo y mostró qué
 * tipos de ID sirven. Faltan dos cosas que sólo se ven mirando las respuestas
 * crudas:
 *
 *  A) ¿Cómo se llama el array de reseñas en la respuesta de ML? El código lee
 *     `data.reviews`. Si ML lo devuelve con otro nombre, siempre son 0.
 *  B) La llamada real a Anthropic usa `thinking` y `output_config` con
 *     json_schema. La prueba anterior fue una llamada simple; si esos
 *     parámetros no existen, la API responde 400 y el batch lo come como error.
 *
 * Sólo lectura. No escribe nada.
 */
import { loadEnv, pedir } from './lib-env.mjs'

const env = loadEnv([
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
  'ML_CLIENT_ID',
  'ML_CLIENT_SECRET'
])

const KEY = env.SUPABASE_SERVICE_ROLE_KEY
const ES_NUEVA = KEY.startsWith('sb_')

function titulo(t) {
  console.log(`\n${'─'.repeat(62)}\n${t}\n${'─'.repeat(62)}`)
}

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

// ---------- A) forma de la respuesta de ML ----------
titulo('A. Forma real de la respuesta de /reviews/item')

const CASOS = ['MLA1485079611', 'MLA1984227318', 'MLAU3900348947']
let ejemplo = null

for (const id of CASOS) {
  const r = await pedir(`https://api.mercadolibre.com/reviews/item/${id}?limit=50`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  })
  if (!r.ok) {
    console.log(`\n  ${id}: HTTP ${r.status}`)
    continue
  }
  const claves = Object.keys(r.body ?? {})
  const arrays = claves.filter(k => Array.isArray(r.body[k]))
  console.log(`\n  ${id}`)
  console.log(`    claves de primer nivel : ${claves.join(', ')}`)
  console.log(`    paging.total           : ${r.body?.paging?.total ?? '(no hay)'}`)
  for (const k of arrays) {
    console.log(`    array "${k}"            : ${r.body[k].length} elementos`)
  }
  console.log(`    ¿existe data.reviews?  : ${Array.isArray(r.body?.reviews) ? `SÍ (${r.body.reviews.length})` : 'NO  ← el código lee esto'}`)

  if (!ejemplo && arrays.length) {
    const arr = r.body[arrays[0]]
    if (arr.length) {
      ejemplo = arr[0]
      console.log(`\n    Primer elemento de "${arrays[0]}":`)
      console.log(`      campos: ${Object.keys(ejemplo).join(', ')}`)
      const texto = ejemplo.content ?? ejemplo.comment ?? ejemplo.text ?? null
      console.log(`      rate/rating: ${ejemplo.rate ?? ejemplo.rating ?? '(no hay)'}`)
      console.log(`      texto: ${texto ? JSON.stringify(String(texto).slice(0, 80)) : '(no hay campo content ni comment)'}`)
    }
  }
  await new Promise(s => setTimeout(s, 400))
}

// ---------- B) la llamada real a Anthropic ----------
titulo('B. La llamada a Anthropic tal cual la hace lib/reviews.ts')

const SCHEMA = {
  type: 'object',
  properties: {
    ai_summary: { type: 'string' },
    pros: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    cons: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    sizing_notes: { type: ['string', 'null'] },
    sentiment_score: { type: 'number', minimum: 0, maximum: 1 }
  },
  required: ['ai_summary', 'pros', 'cons', 'sentiment_score'],
  additionalProperties: false
}

async function probar(nombre, cuerpo) {
  const r = await pedir('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify(cuerpo)
  })
  const detalle = r.ok ? '' : ` — ${(r.body?.error?.message ?? r.raw).toString().slice(0, 180)}`
  console.log(`  ${r.ok ? '✓' : '✗'} ${nombre}: HTTP ${r.status}${detalle}`)
  return r.ok
}

const base = {
  model: 'claude-opus-4-7',
  max_tokens: 512,
  messages: [{ role: 'user', content: 'Analizá: "Muy bueno, llegó rápido". Devolvé el JSON pedido.' }]
}

await probar('sola (sin thinking ni output_config)', base)
await probar('con thinking adaptive', { ...base, thinking: { type: 'adaptive' } })
await probar('con output_config json_schema', {
  ...base,
  output_config: { format: { type: 'json_schema', schema: SCHEMA } }
})
await probar('con las dos, como en producción', {
  ...base,
  thinking: { type: 'adaptive' },
  output_config: { format: { type: 'json_schema', schema: SCHEMA } }
})

console.log('')
