'use server'

import { cookies } from 'next/headers'

const SESSION_COOKIE = 'fio_session'
const API_KEY_COOKIE = 'fio_api_key'

export async function getSession(): Promise<{ token: string; apiKey: string } | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const apiKey = cookieStore.get(API_KEY_COOKIE)?.value

  if (!token || !apiKey) return null
  return { token, apiKey }
}

export async function setSession(token: string, apiKey: string): Promise<void> {
  const cookieStore = await cookies()
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  }

  cookieStore.set(SESSION_COOKIE, token, opts)
  cookieStore.set(API_KEY_COOKIE, apiKey, opts)
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
  cookieStore.delete(API_KEY_COOKIE)
}
