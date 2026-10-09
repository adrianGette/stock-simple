import { Module } from '@nestjs/common'
import { ProfilePhotoController } from './profile-photo.controller'
import { ProfilePhotoService } from './profile-photo.service'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'

@Module({
  controllers: [UsersController, ProfilePhotoController],
  providers: [UsersService, ProfilePhotoService],
})
export class UsersModule {}
