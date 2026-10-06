import { z } from 'zod'
import { ROLES, type Role } from '../permissions'

const name = z.string().trim().min(2, 'Mínimo 2 caracteres').max(80, 'Máximo 80 caracteres')
// bcrypt/argon trabajan bien hasta 72 bytes; acotamos para evitar abusos.
const password = z.string().min(8, 'Mínimo 8 caracteres').max(72, 'Máximo 72 caracteres')

export const createUserSchema = z.object({
  name,
  email: z.email('Ingresá un email válido').trim().toLowerCase(),
  password,
  role: z.enum(ROLES),
})
export type CreateUserInput = z.infer<typeof createUserSchema>

export const updateUserSchema = z
  .object({
    name: name.optional(),
    role: z.enum(ROLES).optional(),
    active: z.boolean().optional(),
    password: password.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'No hay cambios para guardar')
export type UpdateUserInput = z.infer<typeof updateUserSchema>

export interface UserDto {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
  createdAt: string
  lastLoginAt: string | null
}
