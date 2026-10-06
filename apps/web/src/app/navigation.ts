import type { Permission } from '@stock/shared'
import type { IconName } from '../shared/ui/Icon'

export interface NavItem {
  to: string
  label: string
  icon: IconName
  permission: Permission
  /** Aparece en la barra inferior del celular (el resto va en "Más"). */
  primary?: boolean
}

/** Única definición de la navegación: el menú y las rutas se filtran con el mismo permiso. */
export const NAV_ITEMS: NavItem[] = [
  { to: '/inicio', label: 'Inicio', icon: 'home', permission: 'reports:read', primary: true },
  { to: '/vender', label: 'Vender', icon: 'pos', permission: 'sales:create', primary: true },
  { to: '/productos', label: 'Productos', icon: 'box', permission: 'products:read', primary: true },
  { to: '/ventas', label: 'Ventas', icon: 'receipt', permission: 'sales:create', primary: true },
  { to: '/precios', label: 'Precios', icon: 'tag', permission: 'prices:bulk-update' },
  { to: '/reportes', label: 'Reportes', icon: 'chart', permission: 'reports:read' },
  { to: '/equipo', label: 'Equipo', icon: 'users', permission: 'users:manage' },
]
