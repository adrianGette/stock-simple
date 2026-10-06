import type { Permission } from '@stock/shared'
import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth, useCurrentUser } from '../features/auth/AuthProvider'
import { LoadingState } from '../shared/ui/Feedback'

/** Protege las rutas privadas. Mientras se recupera la sesión muestra un indicador. */
export function RequireAuth() {
  const { state } = useAuth()
  const location = useLocation()
  if (state.status === 'loading') return <LoadingState label="Recuperando sesión…" />
  if (state.status === 'anonymous') return <Navigate to="/ingresar" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}

export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const user = useCurrentUser()
  return user.can(permission) ? children : <Navigate to="/" replace />
}

/** Cada rol aterriza en la pantalla que más usa: el cajero directo al punto de venta. */
export function HomeRedirect() {
  const user = useCurrentUser()
  return <Navigate to={user.can('reports:read') ? '/inicio' : '/vender'} replace />
}
