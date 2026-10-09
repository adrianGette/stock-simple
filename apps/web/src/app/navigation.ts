import type { Permission } from '@stock/shared'
import type { IconName } from '../shared/ui/Icon'

/** Secciones de la barra lateral, en orden. Inicio va arriba de todo, sin sección. */
export const NAV_GROUPS = ['Operación', 'Catálogo', 'Análisis', 'Administración'] as const
export type NavGroup = (typeof NAV_GROUPS)[number]

export interface NavItem {
  to: string
  label: string
  icon: IconName
  permission: Permission
  group?: NavGroup
  /** Aparece en la barra inferior del celular (el resto va en "Más"). */
  primary?: boolean
}

/** Única definición de la navegación: el menú y las rutas se filtran con el mismo permiso. */
export const NAV_ITEMS: NavItem[] = [
  { to: '/inicio', label: 'Inicio', icon: 'home', permission: 'reports:read', primary: true },
  { to: '/vender', label: 'Vender', icon: 'pos', permission: 'sales:create', group: 'Operación', primary: true },
  { to: '/ventas', label: 'Ventas', icon: 'receipt', permission: 'sales:create', group: 'Operación', primary: true },
  { to: '/productos', label: 'Productos', icon: 'box', permission: 'products:read', group: 'Catálogo', primary: true },
  { to: '/precios', label: 'Precios', icon: 'tag', permission: 'prices:bulk-update', group: 'Catálogo' },
  { to: '/reportes', label: 'Reportes', icon: 'chart', permission: 'reports:read', group: 'Análisis' },
  { to: '/equipo', label: 'Equipo', icon: 'users', permission: 'users:manage', group: 'Administración' },
]
