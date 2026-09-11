/**
 * Dispara un cron de producción a mano, sin esperar al horario.
 *
 *   node scripts/run-cron.mjs analyze-reviews
 *   node scripts/run-cron.mjs seed-prices
 *   node scripts/run-cron.mjs discover-items
 *   node scripts/run-cron.mjs process-alerts
 *
 * Usa el CRON_SECRET de .env.local, el mismo que manda Vercel.
 */
import { loadEnv, pedir } from './lib-env.mjs'

const env = loadEnv(['CRON_SECRET'])
const nombre = process.argv[2]

const VALIDOS = ['seed-prices', 'refresh-tokens', 'analyze-reviews', 'discover-items', 'process-alerts']

if (!nombre || !VALIDOS.includes(nombre)) {
  console.error(`\nUso: node scripts/run-cron.mjs <cron>\n\nCrons: ${VALIDOS.join(', ')}\n`)
  process.exit(1)
}

const base = process.env.LUPA_BASE || 'https://lupaprecios.com'
const url = `${base}/api/cron/${nombre}`

console.log(`\n→ ${url}`)
console.log('  (puede tardar varios minutos: el cron tiene 300s de presupuesto)\n')

const arranque = Date.now()
const r = await pedir(url, { headers: { Authorization: `Bearer ${env.CRON_SECRET}` } })
const seg = Math.round((Date.now() - arranque) / 1000)

console.log(`HTTP ${r.status} en ${seg}s\n`)
console.log(r.body ? JSON.stringify(r.body, null, 2) : r.raw.slice(0, 1000))

if (r.status === 401) {
  // Huella del secreto local: alcanza para compararlo con el de Vercel sin
  // tener que pegarlo en ningún lado.
  const sec = env.CRON_SECRET
  const huella = `${sec.length} caracteres · empieza "${sec.slice(0, 4)}" · termina "${sec.slice(-4)}"`
  console.log('\n  El cron rechazó el secreto. El CRON_SECRET de tu .env.local')
  console.log('  no coincide con el que tiene Vercel en producción.')
  console.log(`\n  El tuyo local: ${huella}`)
  console.log('\n  Comparalo en: Vercel → lupa-web → Settings → Environment')
  console.log('  Variables → CRON_SECRET → el ojito. Si no coincide, copiá el')
  console.log('  de Vercel a tu .env.local.')
}

console.log('')
process.exit(r.ok ? 0 : 1)
