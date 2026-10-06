import { Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import {
  type CreateProduct,
  type Paginated,
  type ProductDto,
  type ProductQuery,
  type UpdateProductInput,
  createProductSchema,
  productQuerySchema,
  updateProductSchema,
} from '@stock/shared'
import type { RequestUser } from '../auth/auth.types'
import { CurrentUser, RequirePermissions } from '../auth/decorators'
import { ApiZodBody, ApiZodQuery, ZodBody, ZodQuery } from '../common/zod'
import { ProductsService } from './products.service'

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermissions('products:read')
  @ApiZodQuery(productQuerySchema)
  list(@CurrentUser() user: RequestUser, @ZodQuery(productQuerySchema) query: ProductQuery): Promise<Paginated<ProductDto>> {
    return this.products.list(user, query)
  }

  @Get('lookup')
  @RequirePermissions('products:read')
  lookup(@CurrentUser() user: RequestUser, @Query('code') code = ''): Promise<ProductDto> {
    return this.products.lookup(user, code)
  }

  @Get(':id')
  @RequirePermissions('products:read')
  get(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string): Promise<ProductDto> {
    return this.products.get(user, id)
  }

  @Post()
  @RequirePermissions('products:write')
  @ApiZodBody(createProductSchema)
  create(
    @CurrentUser() user: RequestUser,
    @ZodBody(createProductSchema) body: CreateProduct,
  ): Promise<ProductDto> {
    return this.products.create(user, body)
  }

  @Patch(':id')
  @RequirePermissions('products:write')
  @ApiZodBody(updateProductSchema)
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ZodBody(updateProductSchema) body: UpdateProductInput,
  ): Promise<ProductDto> {
    return this.products.update(user, id, body)
  }
}
