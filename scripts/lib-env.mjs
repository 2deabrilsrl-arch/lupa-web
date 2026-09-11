/** Lector de .env.local compartido por los scripts. */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export function loadEnv(requeridas = []) {
  const raw = readFileSync(resolve(ROOT, '.env.local'), 'utf8')
  const env = {}
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!m) continue
    env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }
  const faltan = requeridas.filter(k => !env[k])
  if (faltan.length) {
    throw new Error(`Faltan estas variables en .env.local: ${faltan.join(', ')}`)
  }
  return env
}

/** Lee la respuesta como texto y recién ahí intenta parsear. Un cuerpo vacío
 *  no debe explotar: es el bug que ya nos mordió dos veces. */
export async function pedir(url, init = {}) {
  const res = await fetch(url, init)
  const raw = await res.text()
  let body = null
  try {
    body = raw ? JSON.parse(raw) : null
  } catch {
    /* no era JSON */
  }
  return { ok: res.ok, status: res.status, body, raw }
}
