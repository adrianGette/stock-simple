import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { type BulkPriceUpdate, type PricePreviewDto, type PriceUpdateResultDto, bulkPriceUpdateSchema } from '@stock/shared'
import type { RequestUser } from '../auth/auth.types'
import { CurrentUser, RequirePermissions } from '../auth/decorators'
import { ApiZodBody, ZodBody } from '../common/zod'
import { PricingService } from './pricing.service'

@ApiTags('pricing')
@ApiBearerAuth()
@RequirePermissions('prices:bulk-update')
@Controller('prices')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ApiZodBody(bulkPriceUpdateSchema)
  preview(@CurrentUser() user: RequestUser, @ZodBody(bulkPriceUpdateSchema) body: BulkPriceUpdate): Promise<PricePreviewDto> {
    return this.pricing.preview(user, body)
  }

  @Post('apply')
  @HttpCode(HttpStatus.OK)
  @ApiZodBody(bulkPriceUpdateSchema)
  apply(@CurrentUser() user: RequestUser, @ZodBody(bulkPriceUpdateSchema) body: BulkPriceUpdate): Promise<PriceUpdateResultDto> {
    return this.pricing.apply(user, body)
  }
}
