import type { Permission } from '@stock/shared'
import { type ComponentType, Suspense, lazy } from 'react'
import { createBrowserRouter } from 'react-router'
import { LoginPage } from '../features/auth/LoginPage'
import { LoadingState } from '../shared/ui/Feedback'
import { NotFoundPage } from './NotFoundPage'
import { HomeRedirect, RequireAuth, RequirePermission } from './guards'
import { AppShell } from './layout/AppShell'

/** Cada sección se descarga recién cuando se visita (code splitting por ruta). */
function page(load: () => Promise<{ default: ComponentType }>, permission: Permission) {
  const Component = lazy(load)
  return (
    <RequirePermission permission={permission}>
      <Suspense fallback={<LoadingState />}>
        <Component />
      </Suspense>
    </RequirePermission>
  )
}

const named = <K extends string>(promise: Promise<Record<K, ComponentType>>, key: K) =>
  promise.then((module) => ({ default: module[key] }))

export const router = createBrowserRouter([
  { path: '/ingresar', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <HomeRedirect /> },
          { path: 'inicio', element: page(() => named(import('../features/dashboard/DashboardPage'), 'DashboardPage'), 'reports:read') },
          { path: 'vender', element: page(() => named(import('../features/pos/PosPage'), 'PosPage'), 'sales:create') },
          { path: 'productos', element: page(() => named(import('../features/products/ProductsPage'), 'ProductsPage'), 'products:read') },
          {
            path: 'productos/:id',
            element: page(() => named(import('../features/products/ProductDetailPage'), 'ProductDetailPage'), 'products:read'),
          },
          { path: 'ventas', element: page(() => named(import('../features/sales/SalesPage'), 'SalesPage'), 'sales:create') },
          { path: 'precios', element: page(() => named(import('../features/pricing/PricingPage'), 'PricingPage'), 'prices:bulk-update') },
          { path: 'reportes', element: page(() => named(import('../features/reports/ReportsPage'), 'ReportsPage'), 'reports:read') },
          { path: 'equipo', element: page(() => named(import('../features/users/UsersPage'), 'UsersPage'), 'users:manage') },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
