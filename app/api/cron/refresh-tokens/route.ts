import { NextResponse } from 'next/server'
import { refreshExpiringTokens } from '@/lib/ml-auth'

export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await refreshExpiringTokens()
  return NextResponse.json({
    message: 'Token refresh completed',
    ...result,
    timestamp: new Date().toISOString()
  })
}
