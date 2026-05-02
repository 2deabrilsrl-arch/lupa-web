import { NextResponse } from 'next/server'
import { processReviewsBatch } from '@/lib/reviews'

export const maxDuration = 300

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await processReviewsBatch()
  return NextResponse.json({
    message: 'Reviews analysis completed',
    ...result,
    timestamp: new Date().toISOString()
  })
}
