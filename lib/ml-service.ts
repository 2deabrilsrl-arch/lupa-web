/**
 * Server-side helper to call MercadoLibre's API using ANY logged-in user's
 * access token as a "service" token. ML deprecated public unauthenticated
 * access to most item endpoints in 2024 — every server-side call now needs
 * a Bearer token.
 *
 * Strategy:
 *  1. Pick the most recently-refreshed token in user_ml_tokens.
 *  2. If it's about to expire, refresh it via ML's refresh_token grant.
 *  3. On 401, force-refresh once and retry.
 *
 * Risk: if Nadín's account gets banned by ML for abuse the whole app
 * stops fetching. Acceptable for v0.x; will move to per-user tokens or a
 * partner token once usage scales.
 */
import { supabaseAdmin } from './supabase'
import { refreshTokens } from './ml-auth'

const REFRESH_BUFFER_MS = 30 * 60 * 1000

interface ServiceToken {
  user_id: string
  access_token: string
}

/**
 * Caché del token en memoria del proceso.
 *
 * Antes `mlFetch` llamaba a `pickFreshestToken()` en CADA request, y eso es una
 * consulta a Supabase por cada llamada a ML. Con el cron secuencial pasaba
 * desapercibido; al paralelizar, esa consulta se multiplica por la concurrencia
 * y se vuelve el cuello de botella. El token vale ~6 horas: no hay razón para
 * ir a buscarlo a la base más de una vez por invocación.
 *
 * `validUntil` es conservador a propósito: vence antes que el token real, así
 * que el peor caso es una consulta de más, nunca un token muerto.
 */
let cachedToken: { token: ServiceToken; validUntil: number } | null = null

/** Ventana de caché. Corta frente a las ~6h del token: barata y sin riesgo. */
const TOKEN_CACHE_MS = 5 * 60 * 1000

function invalidateTokenCache() {
  cachedToken = null
}

async function pickFreshestToken(): Promise<ServiceToken | null> {
  if (cachedToken && cachedToken.validUntil > Date.now()) {
    return cachedToken.token
  }

  const { data, error } = await supabaseAdmin
    .from('user_ml_tokens')
    .select('user_id, access_token, expires_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ user_id: string; access_token: string; expires_at: string }>()

  if (error || !data) return null

  const expiresMs = new Date(data.expires_at).getTime()
  let token: ServiceToken

  if (expiresMs - Date.now() > REFRESH_BUFFER_MS) {
    token = { user_id: data.user_id, access_token: data.access_token }
  } else {
    const newToken = await refreshTokens(data.user_id)
    if (!newToken) return null
    token = { user_id: data.user_id, access_token: newToken }
  }

  cachedToken = {
    token,
    validUntil: Math.min(Date.now() + TOKEN_CACHE_MS, expiresMs - REFRESH_BUFFER_MS)
  }
  return token
}

export async function getServiceAccessToken(): Promise<string | null> {
  const t = await pickFreshestToken()
  return t?.access_token ?? null
}

// Hard cap on every outbound ML call. Without this, a single hung response
// blocks the caller forever — and that's enough to time-out the whole cron.
const ML_FETCH_TIMEOUT_MS = 8000

/** Techo para el back-off ante un 429. Más que esto y conviene perder el item. */
const MAX_RETRY_AFTER_MS = 5000

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function mlFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await pickFreshestToken()
  if (!token) throw new Error('[ML] No service access token available')

  const url = path.startsWith('http') ? path : `https://api.mercadolibre.com${path}`

  const doFetch = (accessToken: string) => fetch(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(ML_FETCH_TIMEOUT_MS),
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json'
    }
  })

  let res = await doFetch(token.access_token)

  // Token may have just expired between pick and call — retry once with forced refresh.
  if (res.status === 401) {
    invalidateTokenCache()
    const newToken = await refreshTokens(token.user_id)
    if (!newToken) return res
    cachedToken = {
      token: { user_id: token.user_id, access_token: newToken },
      validUntil: Date.now() + TOKEN_CACHE_MS
    }
    res = await doFetch(newToken)
  }

  // ML nos frenó por ritmo. Esperamos lo que pida (con techo) y reintentamos
  // UNA vez. Sin esto, al paralelizar el cron un 429 se contabiliza como fallo
  // del item y le suma un strike que no se ganó.
  if (res.status === 429) {
    const header = Number(res.headers.get('retry-after'))
    const waitMs = Number.isFinite(header) && header > 0
      ? Math.min(header * 1000, MAX_RETRY_AFTER_MS)
      : 1000
    await sleep(waitMs)
    res = await doFetch(cachedToken?.token.access_token ?? token.access_token)
  }

  return res
}
