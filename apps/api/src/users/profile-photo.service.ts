import { HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PROFILE_PHOTO_MAX_BYTES } from '@stock/shared'
import type { RequestUser } from '../auth/auth.types'
import { AppError } from '../common/app-error'
import type { Env } from '../config/env'
import { PrismaService } from '../prisma/prisma.service'

/**
 * Tipo real de la imagen según su firma (los primeros bytes), no según el Content-Type del pedido,
 * que cualquiera puede declarar mal a propósito. WebP: "RIFF" … "WEBP"; JPEG: FF D8 FF.
 * La web genera WebP y, si el navegador no puede (algunas versiones de Safari), JPEG.
 */
export function photoType(bytes: Uint8Array): 'image/webp' | 'image/jpeg' | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to))
  if (bytes.length > 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  return null
}

/** Foto de perfil: cada persona maneja solo la suya; cualquiera del comercio puede verla. */
@Injectable()
export class ProfilePhotoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async setOwn(user: RequestUser, bytes: Uint8Array): Promise<{ photoVersion: string }> {
    this.assertNotDemo()
    if (bytes.length > PROFILE_PHOTO_MAX_BYTES) {
      throw new AppError(HttpStatus.PAYLOAD_TOO_LARGE, 'FILE_TOO_LARGE', 'La foto supera el máximo de 200 KB.')
    }
    if (!photoType(bytes)) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'La foto tiene que ser una imagen WebP o JPEG.')
    }
    const now = new Date()
    await this.prisma.user.update({ where: { id: user.id }, data: { photo: new Uint8Array(bytes), photoUpdatedAt: now } })
    return { photoVersion: now.toISOString() }
  }

  async removeOwn(user: RequestUser): Promise<void> {
    this.assertNotDemo()
    await this.prisma.user.update({ where: { id: user.id }, data: { photo: null, photoUpdatedAt: null } })
  }

  async get(user: RequestUser, userId: string): Promise<{ bytes: Uint8Array; type: string }> {
    // Solo personas del mismo comercio; la foto se pide explícitamente porque PrismaService la omite.
    const found = await this.prisma.user.findFirst({
      where: { id: userId, businessId: user.businessId },
      select: { photo: true },
    })
    if (!found?.photo) throw AppError.notFound('La foto')
    return { bytes: found.photo, type: photoType(found.photo) ?? 'application/octet-stream' }
  }

  /** En la demo pública cualquiera podría subir una imagen inapropiada que verían todos los visitantes. */
  private assertNotDemo(): void {
    if (this.config.get('DEMO_MODE', { infer: true })) {
      throw new AppError(HttpStatus.FORBIDDEN, 'DEMO_READ_ONLY', 'En la demo no se pueden subir fotos, para que siga siendo apta para todos.')
    }
  }
}
