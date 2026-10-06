import { z } from 'zod'
import type { Role } from '../permissions'

export const loginSchema = z.object({
  email: z.email('Ingresá un email válido').trim().toLowerCase(),
  password: z.string().min(1, 'Ingresá tu contraseña'),
})
export type LoginInput = z.infer<typeof loginSchema>

export interface AuthUser {
  id: string
  name: string
  email: string
  role: Role
  business: { id: string; name: string }
}

export interface AuthResponse {
  accessToken: string
  /** Segundos hasta que vence el access token. */
  expiresIn: number
  user: AuthUser
}
