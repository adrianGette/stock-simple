import { Readable } from 'node:stream'
import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, StreamableFile } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiProduces, ApiTags } from '@nestjs/swagger'
import {
  type CreateProduct,
  type Paginated,
  type ProductDto,
  type InventoryCountPreviewDto,
  type InventoryCountResultDto,
  type ProductExportQuery,
  type ProductImportPreviewDto,
  type ProductImportResultDto,
  type ProductLookupQuery,
  type ProductQuery,
  type UpdateProductInput,
  createProductSchema,
  productExportQuerySchema,
  productLookupQuerySchema,
  productQuerySchema,
  toLocalIsoDate,
  updateProductSchema,
} from '@stock/shared'
import type { RequestUser } from '../auth/auth.types'
import { AppError } from '../common/app-error'
import { CurrentUser, RequirePermissions } from '../auth/decorators'
import { ApiZodBody, ApiZodQuery, ZodBody, ZodQuery } from '../common/zod'
import { InventoryCountService } from './inventory-count.service'
import { COUNT_SHEET_COLUMNS } from './product.csv'
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
    private readonly counts: InventoryCountService,
  ) {}

  @Get()
  @RequirePermissions('products:read')
  @ApiZodQuery(productQuerySchema)
  list(@CurrentUser() user: RequestUser, @ZodQuery(productQuerySchema) query: ProductQuery): Promise<Paginated<ProductDto>> {
    return this.products.list(user, query)
  }

  @Get('lookup')
  @RequirePermissions('products:read')
  @ApiZodQuery(productLookupQuerySchema)
  lookup(@CurrentUser() user: RequestUser, @ZodQuery(productLookupQuerySchema) { code }: ProductLookupQuery): Promise<ProductDto> {
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

  /** Planilla para contar la mercadería: SKU, nombre, categoría, stock del sistema y una columna vacía "Contado". */
  @Get('count-sheet')
  @RequirePermissions('stock:adjust')
  @ApiZodQuery(productExportQuerySchema)
  @ApiProduces('text/csv')
  @Header('Cache-Control', 'no-store')
  countSheet(
    @CurrentUser() user: RequestUser,
    @ZodQuery(productExportQuerySchema) query: ProductExportQuery,
  ): StreamableFile {
    const filename = `conteo-${toLocalIsoDate(new Date())}.csv`
    return new StreamableFile(Readable.from(this.products.exportCsv(user, query, COUNT_SHEET_COLUMNS)), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${filename}"`,
    })
  }

  /** Revisa una planilla de conteo: diferencias por producto y movimientos posteriores a la descarga. No guarda nada. */
  @Post('count/preview')
  @HttpCode(200)
  @RequirePermissions('stock:adjust')
  @ApiConsumes('text/csv')
  @ApiBody({ schema: { type: 'string', format: 'binary' } })
  previewCount(@CurrentUser() user: RequestUser, @Body() body: unknown): Promise<InventoryCountPreviewDto> {
    return this.counts.preview(user, csvText(body))
  }

  /** Aplica la planilla de conteo: cada diferencia queda como movimiento "conteo". Todo o nada. */
  @Post('count')
  @RequirePermissions('stock:adjust')
  @ApiConsumes('text/csv')
  @ApiBody({ schema: { type: 'string', format: 'binary' } })
  applyCount(@CurrentUser() user: RequestUser, @Body() body: unknown): Promise<InventoryCountResultDto> {
    return this.counts.apply(user, csvText(body))
  }

  /** Revisa un CSV de productos (crea los SKU nuevos y actualiza los existentes) y devuelve qué pasaría. No guarda nada. */
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
