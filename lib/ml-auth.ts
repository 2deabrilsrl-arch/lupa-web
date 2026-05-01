import { ML_CONFIG, supabaseAdmin } from './supabase'

const REFRESH_BUFFER_MS = 30 * 60 * 1000 // refresh if expires within 30 min

export interface MlTokens {
  user_id: string
  ml_user_id: number
  access_token: string
  refresh_token: string
  expires_at: string
}

/**
 * Refresh a single user's ML tokens using the stored refresh_token.
 * Returns the new access_token, or null if refresh failed.
 */
export async function refreshTokens(userId: string): Promise<string | null> {
  const { data: row, error } = await supabaseAdmin
    .from('user_ml_tokens')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !row) {
    console.error('[ML-Auth] No tokens found for user', userId, error)
    return null
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: ML_CONFIG.clientId,
    client_secret: ML_CONFIG.clientSecret,
    refresh_token: row.refresh_token
  })

  const res = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body: body.toString()
  })

  if (!res.ok) {
    console.error('[ML-Auth] Refresh failed', res.status, await res.text())
    return null
  }

  const data = await res.json()
  const expiresAt = new Date(Date.now() + (data.expires_in ?? 21600) * 1000).toISOString()

  const { error: upErr } = await supabaseAdmin
    .from('user_ml_tokens')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type ?? 'bearer',
      scope: data.scope ?? null,
      expires_at: expiresAt
    })
    .eq('user_id', userId)

  if (upErr) {
    console.error('[ML-Auth] Failed to persist refreshed tokens', upErr)
    return null
  }

  return data.access_token
}

/**
 * Get a valid access_token for a user, refreshing automatically if it's
 * expired or about to expire. Use this anywhere we need to call ML's API
 * on behalf of a user.
 */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('user_ml_tokens')
    .select('access_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return null

  const expiresAtMs = new Date(data.expires_at).getTime()
  if (expiresAtMs - Date.now() > REFRESH_BUFFER_MS) {
    return data.access_token
  }

  return refreshTokens(userId)
}

/**
 * Refresh tokens for all users whose access_token expires within the buffer.
 * Used by the proactive refresh cron.
 */
export async function refreshExpiringTokens(): Promise<{
  total: number
  refreshed: number
  failed: number
}> {
  const cutoff = new Date(Date.now() + REFRESH_BUFFER_MS).toISOString()

  const { data: rows, error } = await supabaseAdmin
    .from('user_ml_tokens')
    .select('user_id')
    .lt('expires_at', cutoff)

  if (error || !rows) {
    console.error('[ML-Auth] Failed to query expiring tokens', error)
    return { total: 0, refreshed: 0, failed: 0 }
  }

  let refreshed = 0
  let failed = 0
  for (const row of rows) {
    const newToken = await refreshTokens(row.user_id)
    if (newToken) refreshed++
    else failed++
  }

  return { total: rows.length, refreshed, failed }
}
