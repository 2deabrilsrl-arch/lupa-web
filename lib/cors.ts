import { NextResponse } from 'next/server'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Lupa-Version',
  'Access-Control-Max-Age': '86400'
}

export function corsResponse<T>(body: T, init: ResponseInit = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...CORS_HEADERS, ...(init.headers as Record<string, string> | undefined) }
  })
}

export function corsPreflight() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}
