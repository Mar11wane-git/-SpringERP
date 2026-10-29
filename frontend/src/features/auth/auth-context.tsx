import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { api, refreshSession, session } from '@/lib/api'
import type { Me, Permission, TokenResponse } from '@/types/api'

type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

interface AuthContextValue {
  status: AuthStatus
  user: Me | null
  login: (email: string, password: string) => Promise<Me>
  logout: () => Promise<void>
  /** Applies a token pair returned by e.g. the change-password endpoint. */
  acceptTokens: (response: TokenResponse) => void
  /** UI-only convenience; the server enforces every permission independently. */
  can: (...permissions: Permission[]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<Me | null>(null)
  const queryClient = useQueryClient()

  const acceptTokens = useCallback((response: TokenResponse) => {
    session.set(response.accessToken)
    setUser(response.user)
    setStatus('authenticated')
  }, [])

  // Restore the session from the HttpOnly refresh cookie on first load.
  useEffect(() => {
    let cancelled = false
    refreshSession().then((res) => {
      if (cancelled) return
      if (res) acceptTokens(res)
      else setStatus('anonymous')
    })
    return () => {
      cancelled = true
    }
  }, [acceptTokens])

  // A failed silent refresh anywhere in the app ends the session.
  useEffect(
    () =>
      session.subscribe((token) => {
        if (token === null) {
          setUser(null)
          setStatus('anonymous')
          queryClient.clear()
        }
      }),
    [queryClient],
  )

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<TokenResponse>('/api/auth/login', { email, password })
      queryClient.clear()
      acceptTokens(res)
      return res.user
    },
    [acceptTokens, queryClient],
  )

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout')
    } finally {
      session.set(null)
    }
  }, [])

  const can = useCallback(
    (...permissions: Permission[]) => !!user && permissions.every((p) => user.permissions.includes(p)),
    [user],
  )

  const value = useMemo(
    () => ({ status, user, login, logout, acceptTokens, can }),
    [status, user, login, logout, acceptTokens, can],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
