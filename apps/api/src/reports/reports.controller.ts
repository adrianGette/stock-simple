import { Controller, Get, Header, StreamableFile } from '@nestjs/common'
import { ApiBearerAuth, ApiProduces, ApiTags } from '@nestjs/swagger'
import {
  type DashboardDto,
  type ReportExportQuery,
  type ReportRange,
  type SalesReportDto,
  reportExportQuerySchema,
  reportRangeSchema,
} from '@stock/shared'
import type { RequestUser } from '../auth/auth.types'
import { CurrentUser, RequirePermissions } from '../auth/decorators'
import { ApiZodQuery, ZodQuery } from '../common/zod'
import { reportFilename } from './reports.csv'
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

  @Get('sales/export')
  @ApiZodQuery(reportExportQuerySchema)
  @ApiProduces('text/csv')
  @Header('Cache-Control', 'no-store')
  async exportSales(
    @CurrentUser() user: RequestUser,
    @ZodQuery(reportExportQuerySchema) query: ReportExportQuery,
  ): Promise<StreamableFile> {
    const csv = await this.reports.salesCsv(user, query)
    return new StreamableFile(Buffer.from(csv, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${reportFilename(query.section, query.from, query.to)}"`,
    })
  }
}
