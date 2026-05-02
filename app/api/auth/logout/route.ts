import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/session'

async function handleLogout(request: Request) {
  const response = NextResponse.redirect(new URL('/', request.url), {
    status: 303
  })
  response.cookies.delete(SESSION_COOKIE)
  return response
}

export async function GET(request: Request) {
  return handleLogout(request)
}

export async function POST(request: Request) {
  return handleLogout(request)
}
