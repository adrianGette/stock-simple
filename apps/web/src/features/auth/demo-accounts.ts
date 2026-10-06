import type { Role } from '@stock/shared'

/** Usuarios que crea el seed de la API (apps/api/prisma/seed.ts). Solo para la demo pública. */
export const DEMO_PASSWORD = 'demo1234'

export const DEMO_ACCOUNTS: { role: Role; label: string; name: string; email: string; description: string }[] = [
  { role: 'OWNER', label: 'Dueña', name: 'Laura', email: 'duena@stocksimple.demo', description: 'Ve todo: costos, reportes y equipo' },
  { role: 'MANAGER', label: 'Encargado', name: 'Martín', email: 'encargado@stocksimple.demo', description: 'Stock, precios y ventas' },
  { role: 'CASHIER', label: 'Cajera', name: 'Sofía', email: 'cajera@stocksimple.demo', description: 'Solo vende; no ve costos' },
]

export const showDemoAccounts = import.meta.env.VITE_SHOW_DEMO_USERS !== 'false'
