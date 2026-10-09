import { Readable } from 'node:stream'
import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, StreamableFile } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiProduces, ApiTags } from '@nestjs/swagger'
import {
  type CreateProduct,
  type Paginated,
  type ProductDto,
  type ProductExportQuery,
  type ProductImportPreviewDto,
  type ProductImportResultDto,
  type ProductQuery,
  type UpdateProductInput,
  createProductSchema,
  productExportQuerySchema,
  productQuerySchema,
  toLocalIsoDate,
  updateProductSchema,
} from '@stock/shared'
import type { RequestUser } from '../auth/auth.types'
import { AppError } from '../common/app-error'
import { CurrentUser, RequirePermissions } from '../auth/decorators'
import { ApiZodBody, ApiZodQuery, ZodBody, ZodQuery } from '../common/zod'
import { decodeCsv } from './product-import'
import { ProductImportService } from './product-import.service'
import { ProductsService } from './products.service'

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly imports: ProductImportService,
  ) {}

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

  @Get('export')
  @RequirePermissions('products:read')
  @ApiZodQuery(productExportQuerySchema)
  @ApiProduces('text/csv')
  @Header('Cache-Control', 'no-store')
  export(
    @CurrentUser() user: RequestUser,
    @ZodQuery(productExportQuerySchema) query: ProductExportQuery,
  ): StreamableFile {
    const filename = `productos-${toLocalIsoDate(new Date())}.csv`
    return new StreamableFile(Readable.from(this.products.exportCsv(user, query)), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${filename}"`,
    })
  }

  /** Revisa un CSV de productos nuevos y devuelve qué pasaría al importarlo. No guarda nada. */
  @Post('import/preview')
  @HttpCode(200)
  @RequirePermissions('products:write')
  @ApiConsumes('text/csv')
  @ApiBody({ schema: { type: 'string', format: 'binary' } })
  previewImport(@CurrentUser() user: RequestUser, @Body() body: unknown): Promise<ProductImportPreviewDto> {
    return this.imports.preview(user, csvText(body))
  }

  /** Importa el CSV si no tiene errores: todos los productos o ninguno. */
  @Post('import')
  @RequirePermissions('products:write')
  @ApiConsumes('text/csv')
  @ApiBody({ schema: { type: 'string', format: 'binary' } })
  import(@CurrentUser() user: RequestUser, @Body() body: unknown): Promise<ProductImportResultDto> {
    return this.imports.import(user, csvText(body))
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

/** El cuerpo llega como bytes crudos solo si el pedido dice `Content-Type: text/csv` (ver setup-app). */
function csvText(body: unknown): string {
  if (!Buffer.isBuffer(body)) {
    throw new AppError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'VALIDATION_FAILED', 'Subí un archivo CSV.')
  }
  return decodeCsv(body)
}
