import { Controller, Get } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { type DashboardDto, type ReportRange, type SalesReportDto, reportRangeSchema } from '@stock/shared'
import type { RequestUser } from '../auth/auth.types'
import { CurrentUser, RequirePermissions } from '../auth/decorators'
import { ApiZodQuery, ZodQuery } from '../common/zod'
import { ReportsService } from './reports.service'

@ApiTags('reports')
@ApiBearerAuth()
@RequirePermissions('reports:read')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: RequestUser): Promise<DashboardDto> {
    return this.reports.dashboard(user)
  }

  @Get('sales')
  @ApiZodQuery(reportRangeSchema)
  sales(@CurrentUser() user: RequestUser, @ZodQuery(reportRangeSchema) range: ReportRange): Promise<SalesReportDto> {
    return this.reports.sales(user, range)
  }
}
