import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'crypto'
import { supabaseAdmin } from './supabase'

export const SESSION_COOKIE = 'lupa_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

function secret() {
  const s = process.env.SESSION_SECRET
  if (!s) throw new Error('SESSION_SECRET is not configured')
  return s
}

function sign(value: string) {
  return createHmac('sha256', secret()).update(value).digest('base64url')
}

export function signSession(userId: string) {
  return `${userId}.${sign(userId)}`
}

export function verifySession(token: string | undefined): string | null {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot < 1) return null
  const userId = token.slice(0, dot)
  const provided = token.slice(dot + 1)
  const expected = sign(userId)
  const a = Buffer.from(provided, 'base64url')
  const b = Buffer.from(expected, 'base64url')
  if (a.length !== b.length) return null
  return timingSafeEqual(a, b) ? userId : null
}

export async function getSessionUser() {
  const userId = verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!userId) return null

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email, display_name, ml_user_id, ml_nickname, plan, alerts_remaining')
    .eq('id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !data) return null
  return data
}

export async function clearSession() {
  ;(await cookies()).delete(SESSION_COOKIE)
}
