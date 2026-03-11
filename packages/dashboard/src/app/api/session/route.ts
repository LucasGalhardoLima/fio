import { NextRequest, NextResponse } from 'next/server'
import { setSessionToken, clearSessionToken } from '@/lib/session'

interface SessionBody {
  token: string
}

function isSessionBody(body: unknown): body is SessionBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    'token' in body &&
    typeof (body as SessionBody).token === 'string' &&
    (body as SessionBody).token.length > 0
  )
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => null)

  if (!isSessionBody(body)) {
    return NextResponse.json(
      { message: 'Missing or invalid token' },
      { status: 400 },
    )
  }

  await setSessionToken(body.token)
  return NextResponse.json({ ok: true })
}

export async function DELETE(): Promise<NextResponse> {
  await clearSessionToken()
  return NextResponse.json({ ok: true })
}
