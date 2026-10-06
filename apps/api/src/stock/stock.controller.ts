import { Controller, DefaultValuePipe, Get, Param, ParseIntPipe, ParseUUIDPipe, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import {
  type Paginated,
  type PriceChangeDto,
  type StockAdjustmentInput,
  type StockMovementDto,
  stockAdjustmentSchema,
} from '@stock/shared'
import type { RequestUser } from '../auth/auth.types'
import { CurrentUser, RequirePermissions } from '../auth/decorators'
import { ApiZodBody, ZodBody } from '../common/zod'
import { StockService } from './stock.service'

@ApiTags('stock')
@ApiBearerAuth()
@Controller('products/:productId')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Post('stock-adjustments')
  @RequirePermissions('stock:adjust')
  @ApiZodBody(stockAdjustmentSchema)
  adjust(
    @CurrentUser() user: RequestUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @ZodBody(stockAdjustmentSchema) body: StockAdjustmentInput,
  ): Promise<StockMovementDto> {
    return this.stock.adjust(user, productId, body)
  }

  @Get('movements')
  @RequirePermissions('stock:adjust')
  movements(
    @CurrentUser() user: RequestUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ): Promise<Paginated<StockMovementDto>> {
    return this.stock.movements(user, productId, Math.max(1, page))
  }

  @Get('price-history')
  @RequirePermissions('products:view-cost')
  priceHistory(@CurrentUser() user: RequestUser, @Param('productId', ParseUUIDPipe) productId: string): Promise<PriceChangeDto[]> {
    return this.stock.priceHistory(user, productId)
  }
}
