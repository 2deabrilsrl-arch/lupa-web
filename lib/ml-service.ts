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

async function pickFreshestToken(): Promise<ServiceToken | null> {
  const { data, error } = await supabaseAdmin
    .from('user_ml_tokens')
    .select('user_id, access_token, expires_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ user_id: string; access_token: string; expires_at: string }>()

  if (error || !data) return null

  const expiresMs = new Date(data.expires_at).getTime()
  if (expiresMs - Date.now() > REFRESH_BUFFER_MS) {
    return { user_id: data.user_id, access_token: data.access_token }
  }

  const newToken = await refreshTokens(data.user_id)
  if (!newToken) return null
  return { user_id: data.user_id, access_token: newToken }
}

export async function getServiceAccessToken(): Promise<string | null> {
  const t = await pickFreshestToken()
  return t?.access_token ?? null
}

export async function mlFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await pickFreshestToken()
  if (!token) throw new Error('[ML] No service access token available')

  const url = path.startsWith('http') ? path : `https://api.mercadolibre.com${path}`

  let res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token.access_token}`,
      Accept: 'application/json'
    }
  })

  // Token may have just expired between pick and call — retry once with forced refresh.
  if (res.status === 401) {
    const newToken = await refreshTokens(token.user_id)
    if (!newToken) return res
    res = await fetch(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${newToken}`,
        Accept: 'application/json'
      }
    })
  }

  return res
}
