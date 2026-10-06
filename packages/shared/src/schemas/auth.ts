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
  /**
   * Demo pública: las cuentas son compartidas por todos los visitantes, así que la API
   * bloquea crear o modificar usuarios (si no, alguien podría cambiar la contraseña y dejar
   * a todos afuera). La web lo usa para explicarlo en lugar de mostrar botones que fallan.
   */
  demoMode: boolean
}

export interface AuthResponse {
  accessToken: string
  /** Segundos hasta que vence el access token. */
  expiresIn: number
  user: AuthUser
}
