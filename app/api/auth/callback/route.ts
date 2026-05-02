import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ML_CONFIG, supabaseAdmin } from '@/lib/supabase'
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/session'
import { sendWelcomeEmail, notifyAdminNewSignup } from '@/lib/email'

const PKCE_COOKIE = 'lupa_pkce'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/error?reason=no_code', request.url))
  }

  const cookieStore = await cookies()
  const verifier = cookieStore.get(PKCE_COOKIE)?.value

  if (!verifier) {
    return NextResponse.redirect(new URL('/error?reason=no_verifier', request.url))
  }

  try {
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: ML_CONFIG.clientId,
      client_secret: ML_CONFIG.clientSecret,
      code,
      redirect_uri: ML_CONFIG.redirectUri,
      code_verifier: verifier
    })

    const tokenRes = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: tokenBody.toString()
    })

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text()
      console.error('[Auth] Token exchange failed:', tokenRes.status, errBody)
      let mlError = ''
      try {
        const parsed = JSON.parse(errBody)
        mlError = parsed.error || parsed.message || errBody.slice(0, 200)
      } catch {
        mlError = errBody.slice(0, 200)
      }
      const url = new URL('/error', request.url)
      url.searchParams.set('reason', 'auth_failed')
      url.searchParams.set('detail', `${tokenRes.status}: ${mlError}`)
      return NextResponse.redirect(url)
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

    // Detect new vs returning user before upsert
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('ml_user_id', mlUserId)
      .maybeSingle()
    const isNewUser = !existing

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
      .select('id, email, ml_nickname')
      .single()

    if (userErr || !user) {
      console.error('[Auth] User upsert failed:', userErr)
      return NextResponse.redirect(new URL('/error?reason=user_save_failed', request.url))
    }

    // Fire-and-forget welcome flow for new users
    if (isNewUser && user.email) {
      sendWelcomeEmail({ to: user.email, userName: user.ml_nickname }).catch(err =>
        console.error('[Auth] sendWelcomeEmail failed', err)
      )
      notifyAdminNewSignup({
        userId: user.id,
        email: user.email,
        nickname: user.ml_nickname,
        mlUserId
      }).catch(err => console.error('[Auth] notifyAdminNewSignup failed', err))
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
    response.cookies.set(SESSION_COOKIE, signSession(user.id), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE
    })
    response.cookies.delete(PKCE_COOKIE)

    return response
  } catch (err) {
    console.error('[Auth] Error:', err)
    return NextResponse.redirect(new URL('/error?reason=server_error', request.url))
  }
}
