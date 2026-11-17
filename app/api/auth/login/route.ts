import { NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'
import { ML_CONFIG } from '@/lib/supabase'
import { NEXT_COOKIE } from '@/lib/session'

const PKCE_COOKIE = 'lupa_pkce'

/**
 * A dónde volver después de loguearse. Sólo rutas propias: cualquier cosa que
 * no empiece con una sola barra se descarta, así nadie puede usar el login
 * como trampolín a otro sitio.
 */
function destinoSeguro(raw: string | null): string | null {
  if (!raw) return null
  if (!raw.startsWith('/') || raw.startsWith('//')) return null
  return raw.slice(0, 512)
}

export async function GET(request: Request) {
  const next = destinoSeguro(new URL(request.url).searchParams.get('next'))
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')

  const authUrl = new URL('https://auth.mercadolibre.com.ar/authorization')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', ML_CONFIG.clientId)
  authUrl.searchParams.set('redirect_uri', ML_CONFIG.redirectUri)
  authUrl.searchParams.set('code_challenge', challenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')

  const response = NextResponse.redirect(authUrl)
  response.cookies.set(PKCE_COOKIE, verifier, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600
  })
  if (next) {
    response.cookies.set(NEXT_COOKIE, next, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 600
    })
  }
  return response
}
