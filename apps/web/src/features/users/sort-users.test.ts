import type { UserDto } from '@stock/shared'
import { describe, expect, it } from 'vitest'
import { sortUsers } from './sort-users'

const user = (id: string, overrides: Partial<UserDto>): UserDto => ({
  id,
  name: id,
  email: `${id}@test.dev`,
  role: 'CASHIER',
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: null,
  ...overrides,
})

const team = [
  user('1', { name: 'Sofía', role: 'CASHIER', lastLoginAt: '2026-10-08T10:00:00.000Z' }),
  user('2', { name: 'Ángela', role: 'MANAGER', active: false }),
  user('3', { name: 'Laura', role: 'OWNER', lastLoginAt: '2026-10-01T10:00:00.000Z' }),
  user('4', { name: 'martín', role: 'MANAGER', lastLoginAt: '2026-10-05T10:00:00.000Z' }),
]
const names = (users: UserDto[]) => users.map((u) => u.name)

describe('sortUsers', () => {
  it('ordena por nombre como un diccionario en español (acentos y mayúsculas no alteran el orden)', () => {
    expect(names(sortUsers(team, 'name', 'asc'))).toEqual(['Ángela', 'Laura', 'martín', 'Sofía'])
    expect(names(sortUsers(team, 'name', 'desc'))).toEqual(['Sofía', 'martín', 'Laura', 'Ángela'])
  })

  it('ordena por rol según la jerarquía, desempatando por nombre', () => {
    expect(names(sortUsers(team, 'role', 'asc'))).toEqual(['Laura', 'Ángela', 'martín', 'Sofía'])
  })

  it('por estado, ascendente pone primero a los activos', () => {
    expect(names(sortUsers(team, 'status', 'asc'))).toEqual(['Laura', 'martín', 'Sofía', 'Ángela'])
    expect(names(sortUsers(team, 'status', 'desc'))[0]).toBe('Ángela')
  })

  it('por último ingreso, quien nunca ingresó queda al final en las dos direcciones', () => {
    expect(names(sortUsers(team, 'lastLogin', 'desc'))).toEqual(['Sofía', 'martín', 'Laura', 'Ángela'])
    expect(names(sortUsers(team, 'lastLogin', 'asc'))).toEqual(['Laura', 'martín', 'Sofía', 'Ángela'])
  })

  it('no modifica la lista original', () => {
    const before = names(team)
    sortUsers(team, 'name', 'desc')
    expect(names(team)).toEqual(before)
  })
})
