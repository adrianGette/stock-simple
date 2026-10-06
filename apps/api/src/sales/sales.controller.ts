import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import {
  type CreateSaleInput,
  type Paginated,
  type SaleDto,
  type SaleQuery,
  type SaleSummaryDto,
  type VoidSaleInput,
  createSaleSchema,
  saleQuerySchema,
  voidSaleSchema,
} from '@stock/shared'
import type { RequestUser } from '../auth/auth.types'
import { CurrentUser, RequirePermissions } from '../auth/decorators'
import { ApiZodBody, ApiZodQuery, ZodBody, ZodQuery } from '../common/zod'
import { SalesService } from './sales.service'

@ApiTags('sales')
@ApiBearerAuth()
@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Post()
  @RequirePermissions('sales:create')
  @ApiZodBody(createSaleSchema)
  create(@CurrentUser() user: RequestUser, @ZodBody(createSaleSchema) body: CreateSaleInput): Promise<SaleDto> {
    return this.sales.create(user, body)
  }

  @Get()
  @RequirePermissions('sales:create')
  @ApiZodQuery(saleQuerySchema)
  list(@CurrentUser() user: RequestUser, @ZodQuery(saleQuerySchema) query: SaleQuery): Promise<Paginated<SaleSummaryDto>> {
    return this.sales.list(user, query)
  }

  @Get(':id')
  @RequirePermissions('sales:create')
  get(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string): Promise<SaleDto> {
    return this.sales.get(user, id)
  }

  @Post(':id/void')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('sales:void')
  @ApiZodBody(voidSaleSchema)
  void(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ZodBody(voidSaleSchema) body: VoidSaleInput,
  ): Promise<SaleDto> {
    return this.sales.void(user, id, body)
  }
}
