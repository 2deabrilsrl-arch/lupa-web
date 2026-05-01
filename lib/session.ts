import { cookies } from 'next/headers'
import { supabaseAdmin } from './supabase'

export const SESSION_COOKIE = 'lupa_session'

export async function getSessionUser() {
  const userId = (await cookies()).get(SESSION_COOKIE)?.value
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
