import { Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { type AuthResponse, type AuthUser, type LoginInput, loginSchema } from '@stock/shared'
import type { CookieOptions, Request, Response } from 'express'
import { ApiZodBody, ZodBody } from '../common/zod'
import type { Env } from '../config/env'
import { AuthService, type IssuedSession } from './auth.service'
import type { RequestUser } from './auth.types'
import { CurrentUser, Public } from './decorators'

export const REFRESH_COOKIE = 'ss_refresh'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiZodBody(loginSchema)
  async login(@ZodBody(loginSchema) body: LoginInput, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    return this.withCookie(res, await this.auth.login(body, req.headers['user-agent']))
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    try {
      return this.withCookie(res, await this.auth.refresh(req.cookies?.[REFRESH_COOKIE], req.headers['user-agent']))
    } catch (error) {
      res.clearCookie(REFRESH_COOKIE, this.cookieOptions())
      throw error
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE])
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions())
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: RequestUser): Promise<AuthUser> {
    return this.auth.me(user.id)
  }

  private withCookie(res: Response, session: IssuedSession): AuthResponse {
    res.cookie(REFRESH_COOKIE, session.refreshToken, { ...this.cookieOptions(), expires: session.refreshExpiresAt })
    return session.response
  }

  /**
   * El refresh token vive en una cookie httpOnly (inaccesible desde JS), limitada a /api/auth.
   * Ver ADR 0004: en producción la web llega a la API por un proxy del mismo origen.
   */
  private cookieOptions(): CookieOptions {
    const sameSite = this.config.get('COOKIE_SAME_SITE', { infer: true })
    const secure = this.config.get('NODE_ENV', { infer: true }) === 'production' || sameSite === 'none'
    return { httpOnly: true, secure, sameSite, path: '/api/auth' }
  }
}
