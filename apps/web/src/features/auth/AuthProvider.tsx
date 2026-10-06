import type { AuthResponse, AuthUser, LoginInput, Permission } from '@stock/shared'
import { can } from '@stock/shared'
import { useQueryClient } from '@tanstack/react-query'
import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, hasSessionHint, refreshSession, session, waitForServer } from '../../lib/api-client'

type AuthState = { status: 'loading' } | { status: 'anonymous' } | { status: 'authenticated'; user: AuthUser }

interface AuthContextValue {
  state: AuthState
  login: (input: LoginInput) => Promise<AuthUser>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // Si este navegador nunca tuvo sesión, no hace falta esperar al refresh: se muestra el login directo.
  const [state, setState] = useState<AuthState>(() => (hasSessionHint() ? { status: 'loading' } : { status: 'anonymous' }))
  const queryClient = useQueryClient()

  const apply = useCallback(
    (response: AuthResponse | null) => {
      session.set(response)
      if (response) {
        setState({ status: 'authenticated', user: response.user })
      } else {
        setState({ status: 'anonymous' })
        queryClient.clear()
      }
    },
    [queryClient],
  )

  // Al cargar, intenta recuperar la sesión con la cookie httpOnly de refresh.
  useEffect(() => {
    const unsubscribe = session.subscribe(apply)
    // Primero se despierta el servidor (si estaba dormido) y recién después se renueva la sesión:
    // así el refresh token no se rota en una request que el proxy ya dio por perdida.
    if (hasSessionHint()) void waitForServer().then(() => refreshSession())
    else void waitForServer()
    return unsubscribe
  }, [apply])

  const login = useCallback(
    async (input: LoginInput) => {
      await waitForServer()
      const response = await api<AuthResponse>('/auth/login', { method: 'POST', body: input })
      queryClient.clear()
      apply(response)
      return response.user
    },
    [apply, queryClient],
  )

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined)
    apply(null)
  }, [apply])

  const value = useMemo(() => ({ state, login, logout }), [state, login, logout])
  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return context
}

/** Usuario actual. Solo usar dentro de rutas protegidas. */
export function useCurrentUser(): AuthUser & { can: (permission: Permission) => boolean } {
  const { state } = useAuth()
  const user = state.status === 'authenticated' ? state.user : null
  const value = useMemo(() => user && { ...user, can: (permission: Permission) => can(user.role, permission) }, [user])
  if (!value) throw new Error('No hay sesión activa')
  return value
}
