import { describe, expect, it } from 'vitest'
import { PERMISSIONS, can } from './permissions'

describe('can', () => {
  it('el dueño tiene todos los permisos', () => {
    expect(PERMISSIONS.every((p) => can('OWNER', p))).toBe(true)
  })

  it('el encargado no administra usuarios', () => {
    expect(can('MANAGER', 'users:manage')).toBe(false)
    expect(can('MANAGER', 'prices:bulk-update')).toBe(true)
  })

  it('el cajero vende pero no ve costos', () => {
    expect(can('CASHIER', 'sales:create')).toBe(true)
    expect(can('CASHIER', 'products:view-cost')).toBe(false)
    expect(can('CASHIER', 'reports:read')).toBe(false)
  })
})
