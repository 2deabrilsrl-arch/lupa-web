import { NextResponse } from 'next/server'
import { extractMlItemId } from '@/lib/ml-url'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('url') ?? searchParams.get('q') ?? ''
  const id = extractMlItemId(raw)
  if (!id) {
    const back = new URL('/', request.url)
    back.searchParams.set('lookup_error', '1')
    return NextResponse.redirect(back, { status: 303 })
  }
  return NextResponse.redirect(new URL(`/p/${id}`, request.url), { status: 303 })
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const raw = (formData.get('url') as string) ?? ''
  const id = extractMlItemId(raw)
  if (!id) {
    const back = new URL('/', request.url)
    back.searchParams.set('lookup_error', '1')
    return NextResponse.redirect(back, { status: 303 })
  }
  return NextResponse.redirect(new URL(`/p/${id}`, request.url), { status: 303 })
}
