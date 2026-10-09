import type { Role, SortDirection, UserDto } from '@stock/shared'

/**
 * El equipo de un comercio son pocas personas y la API las devuelve todas juntas (sin paginar),
 * así que se ordena en el navegador: no hace falta volver a pedirle nada al servidor.
 */
export const USER_SORTS = ['name', 'role', 'status', 'lastLogin'] as const
export type UserSort = (typeof USER_SORTS)[number]

// Compara como un diccionario en español: "Ángela" va con las A y no después de la Z.
const collator = new Intl.Collator('es', { sensitivity: 'base' })

// Por jerarquía y no alfabético: es como se piensa un equipo.
const ROLE_RANK: Record<Role, number> = { OWNER: 0, MANAGER: 1, CASHIER: 2 }

const COMPARE: Record<Exclude<UserSort, 'lastLogin'>, (a: UserDto, b: UserDto) => number> = {
  name: (a, b) => collator.compare(a.name, b.name),
  role: (a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role],
  // Ascendente = activos primero.
  status: (a, b) => Number(b.active) - Number(a.active),
}

export function sortUsers(users: readonly UserDto[], sort: UserSort, dir: SortDirection): UserDto[] {
  const sign = dir === 'asc' ? 1 : -1
  return users.toSorted((a, b) => {
    let result: number
    if (sort === 'lastLogin') {
      // Quien nunca ingresó va siempre al final, en cualquier dirección.
      if (!a.lastLoginAt || !b.lastLoginAt) return Number(!a.lastLoginAt) - Number(!b.lastLoginAt) || COMPARE.name(a, b)
      result = sign * (Date.parse(a.lastLoginAt) - Date.parse(b.lastLoginAt))
    } else {
      result = sign * COMPARE[sort](a, b)
    }
    // Desempate estable: por nombre y, si hay homónimos, por id.
    return result || COMPARE.name(a, b) || a.id.localeCompare(b.id)
  })
}
