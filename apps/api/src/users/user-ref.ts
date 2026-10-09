import type { UserRef } from '@stock/shared'
import type { Prisma } from '../generated/prisma/client'

/** Lo mínimo para mostrar a una persona (nombre y avatar) donde aparece como autora de algo. */
export const userRefSelect = { id: true, name: true, photoUpdatedAt: true } satisfies Prisma.UserSelect

export function toUserRef(user: { id: string; name: string; photoUpdatedAt: Date | null }): UserRef {
  return { id: user.id, name: user.name, photoVersion: user.photoUpdatedAt?.toISOString() ?? null }
}
