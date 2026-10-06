export const ROLES = ['OWNER', 'MANAGER', 'CASHIER'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Dueño/a',
  MANAGER: 'Encargado/a',
  CASHIER: 'Cajero/a',
}

export const PERMISSIONS = [
  'products:read',
  'products:write',
  'products:view-cost',
  'stock:adjust',
  'prices:bulk-update',
  'sales:create',
  'sales:read-all',
  'sales:void',
  'reports:read',
  'users:manage',
] as const
export type Permission = (typeof PERMISSIONS)[number]

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  OWNER: new Set(PERMISSIONS),
  MANAGER: new Set(PERMISSIONS.filter((p) => p !== 'users:manage')),
  // El cajero vende y consulta precios, pero no ve costos ni márgenes.
  CASHIER: new Set<Permission>(['products:read', 'sales:create']),
}

/** Única fuente de verdad de permisos: la usan los guards de la API y la UI. */
export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission)
}
