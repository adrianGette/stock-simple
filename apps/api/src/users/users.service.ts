import { HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { CreateUserInput, UpdateUserInput, UserDto } from '@stock/shared'
import * as argon2 from 'argon2'
import { AppError } from '../common/app-error'
import type { Env } from '../config/env'
import type { User } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type { RequestUser } from '../auth/auth.types'

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async list(businessId: string): Promise<UserDto[]> {
    const users = await this.prisma.user.findMany({ where: { businessId }, orderBy: [{ active: 'desc' }, { name: 'asc' }] })
    return users.map(toUserDto)
  }

  async create(actor: RequestUser, input: CreateUserInput): Promise<UserDto> {
    this.assertNotDemo()
    await this.assertEmailFree(input.email)
    const user = await this.prisma.user.create({
      data: {
        businessId: actor.businessId,
        name: input.name,
        email: input.email,
        role: input.role,
        passwordHash: await argon2.hash(input.password),
      },
    })
    return toUserDto(user)
  }

  async update(actor: RequestUser, id: string, input: UpdateUserInput): Promise<UserDto> {
    this.assertNotDemo()
    const current = await this.prisma.user.findFirst({ where: { id, businessId: actor.businessId } })
    if (!current) throw AppError.notFound('El usuario')

    // Evita que el dueño se quite a sí mismo el acceso y deje el comercio sin administrador.
    const changesOwnAccess = (input.role !== undefined && input.role !== current.role) || input.active === false
    if (id === actor.id && changesOwnAccess) {
      throw AppError.unprocessable('CANNOT_MODIFY_SELF', 'No podés cambiar tu propio rol ni desactivarte')
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          name: input.name,
          role: input.role,
          active: input.active,
          passwordHash: input.password ? await argon2.hash(input.password) : undefined,
        },
      })
      // Al desactivar o cambiar la contraseña se cierran todas sus sesiones abiertas.
      if (input.active === false || input.password) {
        await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } })
      }
      return updated
    })
    return toUserDto(user)
  }

  /** En la demo pública las cuentas son compartidas: nadie puede cambiarlas ni crear otras. */
  private assertNotDemo(): void {
    if (this.config.get('DEMO_MODE', { infer: true })) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        'DEMO_READ_ONLY',
        'En la demo no se pueden crear ni modificar usuarios, para que siga funcionando para todos.',
      )
    }
  }

  private async assertEmailFree(email: string): Promise<void> {
    const exists = await this.prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (exists) throw AppError.conflict('EMAIL_TAKEN', 'Ya hay un usuario con ese email')
  }
}

function toUserDto(user: Omit<User, 'photo'>): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    photoVersion: user.photoUpdatedAt?.toISOString() ?? null,
  }
}
