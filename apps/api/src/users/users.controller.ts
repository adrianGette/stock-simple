import { Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { type CreateUserInput, type UpdateUserInput, type UserDto, createUserSchema, updateUserSchema } from '@stock/shared'
import type { RequestUser } from '../auth/auth.types'
import { CurrentUser, RequirePermissions } from '../auth/decorators'
import { ApiZodBody, ZodBody } from '../common/zod'
import { UsersService } from './users.service'

@ApiTags('users')
@ApiBearerAuth()
@RequirePermissions('users:manage')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentUser() user: RequestUser): Promise<UserDto[]> {
    return this.users.list(user.businessId)
  }

  @Post()
  @ApiZodBody(createUserSchema)
  create(@CurrentUser() user: RequestUser, @ZodBody(createUserSchema) body: CreateUserInput): Promise<UserDto> {
    return this.users.create(user, body)
  }

  @Patch(':id')
  @ApiZodBody(updateUserSchema)
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ZodBody(updateUserSchema) body: UpdateUserInput,
  ): Promise<UserDto> {
    return this.users.update(user, id, body)
  }
}
