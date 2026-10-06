import { Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { type CategoryDto, type CategoryInput, categoryInputSchema } from '@stock/shared'
import type { RequestUser } from '../auth/auth.types'
import { CurrentUser, RequirePermissions } from '../auth/decorators'
import { ApiZodBody, ZodBody } from '../common/zod'
import { CategoriesService } from './categories.service'

@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @RequirePermissions('products:read')
  list(@CurrentUser() user: RequestUser): Promise<CategoryDto[]> {
    return this.categories.list(user.businessId)
  }

  @Post()
  @RequirePermissions('products:write')
  @ApiZodBody(categoryInputSchema)
  create(@CurrentUser() user: RequestUser, @ZodBody(categoryInputSchema) body: CategoryInput): Promise<CategoryDto> {
    return this.categories.create(user.businessId, body)
  }

  @Patch(':id')
  @RequirePermissions('products:write')
  @ApiZodBody(categoryInputSchema)
  rename(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ZodBody(categoryInputSchema) body: CategoryInput,
  ): Promise<CategoryDto> {
    return this.categories.rename(user.businessId, id, body)
  }

  @Delete(':id')
  @RequirePermissions('products:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.categories.remove(user.businessId, id)
  }
}
