import type { Role } from '@stock/shared'
import type { Request } from 'express'

/** Usuario autenticado que los guards adjuntan al request. */
export interface RequestUser {
  id: string
  name: string
  role: Role
  businessId: string
  timezone: string
}

export interface AuthenticatedRequest extends Request {
  user: RequestUser
}

export interface AccessTokenPayload {
  sub: string
  bid: string
  role: Role
}
