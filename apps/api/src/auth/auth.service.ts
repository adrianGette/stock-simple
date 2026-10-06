import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import type { AuthResponse, AuthUser, LoginInput } from '@stock/shared'
import * as argon2 from 'argon2'
import { AppError } from '../common/app-error'
import type { Env } from '../config/env'
import { PrismaService } from '../prisma/prisma.service'
import type { AccessTokenPayload } from './auth.types'

/** Si un token rotado se reutiliza dentro de esta ventana, se asume una carrera entre pestañas y no un robo. */
const REUSE_GRACE_MS = 10_000

export interface IssuedSession {
  response: AuthResponse
  refreshToken: string
  refreshExpiresAt: Date
}

const userWithBusiness = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  business: { select: { id: true, name: true } },
} as const

type UserWithBusiness = { id: string; name: string; email: string; role: AuthUser['role']; business: AuthUser['business'] }

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

@Injectable()
export class AuthService {
  // Hash señuelo: si el email no existe igual verificamos, así el tiempo de respuesta
  // no revela qué emails están registrados.
  private readonly dummyHash = argon2.hash(randomUUID())

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async login({ email, password }: LoginInput, userAgent?: string): Promise<IssuedSession> {
    const user = await this.prisma.user.findUnique({ where: { email }, select: { ...userWithBusiness, passwordHash: true } })
    const valid = await argon2.verify(user?.passwordHash ?? (await this.dummyHash), password)
    if (!user || !valid || !user.active) {
      throw new AppError(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Email o contraseña incorrectos')
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    return this.issueSession(user, randomUUID(), userAgent)
  }

  /** Rota el refresh token: invalida el actual y entrega uno nuevo de la misma familia. */
  async refresh(refreshToken: string | undefined, userAgent?: string): Promise<IssuedSession> {
    if (!refreshToken) throw new UnauthorizedException()

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: { select: userWithBusiness } },
    })
    if (!session) throw new UnauthorizedException()

    if (session.revokedAt) {
      if (Date.now() - session.revokedAt.getTime() > REUSE_GRACE_MS) {
        // Reutilización de un token viejo: posible robo. Cerramos todas las sesiones de la familia.
        await this.prisma.session.updateMany({ where: { familyId: session.familyId, revokedAt: null }, data: { revokedAt: new Date() } })
      }
      throw new UnauthorizedException()
    }
    if (session.expiresAt < new Date() || !session.user.active) throw new UnauthorizedException()

    // El updateMany condicional evita que dos pedidos simultáneos roten el mismo token.
    const { count } = await this.prisma.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    if (count === 0) throw new UnauthorizedException()

    return this.issueSession(session.user, session.familyId, userAgent)
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return
    await this.prisma.session.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: userWithBusiness })
    return this.toAuthUser(user)
  }

  private toAuthUser(user: UserWithBusiness): AuthUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      business: user.business,
      demoMode: this.config.get('DEMO_MODE', { infer: true }),
    }
  }

  private async issueSession(user: UserWithBusiness, familyId: string, userAgent?: string): Promise<IssuedSession> {
    const expiresIn = this.config.get('ACCESS_TOKEN_TTL_SECONDS', { infer: true })
    const payload: AccessTokenPayload = { sub: user.id, bid: user.business.id, role: user.role }
    const accessToken = await this.jwt.signAsync(payload, { expiresIn })

    const refreshToken = randomBytes(32).toString('base64url')
    const refreshExpiresAt = new Date(Date.now() + this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) * 86_400_000)
    await this.prisma.session.create({
      data: { userId: user.id, tokenHash: hashToken(refreshToken), familyId, expiresAt: refreshExpiresAt, userAgent: userAgent?.slice(0, 255) },
    })

    return { response: { accessToken, expiresIn, user: this.toAuthUser(user) }, refreshToken, refreshExpiresAt }
  }
}
