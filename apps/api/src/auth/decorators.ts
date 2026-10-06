import { type ExecutionContext, SetMetadata, createParamDecorator } from '@nestjs/common'
import type { Permission } from '@stock/shared'
import type { AuthenticatedRequest, RequestUser } from './auth.types'

export const IS_PUBLIC_KEY = 'isPublic'
export const PERMISSIONS_KEY = 'permissions'

/** Marca una ruta como accesible sin sesión. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)

/** Exige todos los permisos indicados (ver `can` en @stock/shared). */
export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions)

export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): RequestUser => context.switchToHttp().getRequest<AuthenticatedRequest>().user,
)
