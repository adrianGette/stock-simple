import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma/prisma.service'
import type { AccessTokenPayload, AuthenticatedRequest } from './auth.types'
import { IS_PUBLIC_KEY } from './decorators'

/**
 * Guard global: toda ruta requiere un access token válido salvo las marcadas con @Public().
 * Además de verificar la firma, relee el usuario para que un cambio de rol o una baja
 * tengan efecto inmediato y no recién cuando vence el token.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const [scheme, token] = request.headers.authorization?.split(' ') ?? []
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException()

    let payload: AccessTokenPayload
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token)
    } catch {
      throw new UnauthorizedException()
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, role: true, active: true, businessId: true, business: { select: { timezone: true } } },
    })
    if (!user?.active) throw new UnauthorizedException()

    request.user = { id: user.id, name: user.name, role: user.role, businessId: user.businessId, timezone: user.business.timezone }
    return true
  }
}
