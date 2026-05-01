import { NextResponse } from 'next/server'
import { ML_CONFIG, supabaseAdmin } from '@/lib/supabase'

const SESSION_COOKIE = 'lupa_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/error?reason=no_code', request.url))
  }

  try {
    const tokenRes = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: ML_CONFIG.clientId,
        client_secret: ML_CONFIG.clientSecret,
        code,
        redirect_uri: ML_CONFIG.redirectUri
      })
    })

    if (!tokenRes.ok) {
      console.error('[Auth] Token exchange failed:', await tokenRes.text())
      return NextResponse.redirect(new URL('/error?reason=auth_failed', request.url))
    }

    const tokenData = await tokenRes.json()
    const { access_token, refresh_token, expires_in, scope, token_type, user_id: mlUserId } = tokenData

    const meRes = await fetch('https://api.mercadolibre.com/users/me', {
      headers: { Authorization: `Bearer ${access_token}` }
    })

    if (!meRes.ok) {
      console.error('[Auth] /users/me failed:', await meRes.text())
      return NextResponse.redirect(new URL('/error?reason=user_fetch_failed', request.url))
    }

    const mlUser = await meRes.json()

    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .upsert(
        {
          email: mlUser.email ?? null,
          display_name: mlUser.nickname ?? mlUser.first_name ?? null,
          ml_user_id: mlUserId,
          ml_nickname: mlUser.nickname ?? null,
          last_active_at: new Date().toISOString()
        },
        { onConflict: 'ml_user_id', ignoreDuplicates: false }
      )
      .select('id')
      .single()

    if (userErr || !user) {
      console.error('[Auth] User upsert failed:', userErr)
      return NextResponse.redirect(new URL('/error?reason=user_save_failed', request.url))
    }

    const expiresAt = new Date(Date.now() + (expires_in ?? 21600) * 1000).toISOString()

    const { error: tokenErr } = await supabaseAdmin
      .from('user_ml_tokens')
      .upsert(
        {
          user_id: user.id,
          ml_user_id: mlUserId,
          access_token,
          refresh_token,
          token_type: token_type ?? 'bearer',
          scope: scope ?? null,
          expires_at: expiresAt
        },
        { onConflict: 'user_id' }
      )

    if (tokenErr) {
      console.error('[Auth] Token save failed:', tokenErr)
      return NextResponse.redirect(new URL('/error?reason=token_save_failed', request.url))
    }

    const response = NextResponse.redirect(new URL('/dashboard', request.url))
    response.cookies.set(SESSION_COOKIE, user.id, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE
    })

    return response
  } catch (err) {
    console.error('[Auth] Error:', err)
    return NextResponse.redirect(new URL('/error?reason=server_error', request.url))
  }
}
