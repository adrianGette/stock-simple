import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, ParseUUIDPipe, Put, StreamableFile } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiProduces, ApiTags } from '@nestjs/swagger'
import type { RequestUser } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators'
import { AppError } from '../common/app-error'
import { ProfilePhotoService } from './profile-photo.service'

/** Sin permisos especiales: cualquier persona con sesión maneja su propia foto y ve las de su comercio. */
@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class ProfilePhotoController {
  constructor(private readonly photos: ProfilePhotoService) {}

  @Put('me/photo')
  @HttpCode(200)
  @ApiConsumes('image/webp', 'image/jpeg')
  @ApiBody({ schema: { type: 'string', format: 'binary' } })
  setOwn(@CurrentUser() user: RequestUser, @Body() body: unknown): Promise<{ photoVersion: string }> {
    // El cuerpo llega como bytes crudos solo con Content-Type image/webp o image/jpeg (ver setup-app).
    if (!Buffer.isBuffer(body)) {
      throw new AppError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'VALIDATION_FAILED', 'La foto tiene que ser una imagen WebP o JPEG.')
    }
    return this.photos.setOwn(user, body)
  }

  @Delete('me/photo')
  @HttpCode(204)
  removeOwn(@CurrentUser() user: RequestUser): Promise<void> {
    return this.photos.removeOwn(user)
  }

  /** La web pide la foto con `?v=<versión>`: como la URL cambia con cada foto nueva, se puede guardar en caché para siempre. */
  @Get(':id/photo')
  @ApiProduces('image/webp', 'image/jpeg')
  @Header('Cache-Control', 'private, max-age=31536000, immutable')
  async get(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string): Promise<StreamableFile> {
    const photo = await this.photos.get(user, id)
    return new StreamableFile(photo.bytes, { type: photo.type })
  }
}
