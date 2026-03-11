'use client'

import { createContext, useContext, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface SessionContextValue {
  token: string
  logout: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({
  token,
  children,
}: {
  token: string
  children: React.ReactNode
}) {
  const router = useRouter()

  const logout = useCallback(async () => {
    await fetch('/api/session', { method: 'DELETE' })
    router.push('/login')
  }, [router])

  return (
    <SessionContext.Provider value={{ token, logout }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return ctx
}
