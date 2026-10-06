import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { type Permission, can } from '@stock/shared'
import type { AuthenticatedRequest } from './auth.types'
import { PERMISSIONS_KEY } from './decorators'

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()])
    if (!required?.length) return true

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>()
    if (!user || !required.every((permission) => can(user.role, permission))) {
      throw new ForbiddenException()
    }
    return true
  }
}
