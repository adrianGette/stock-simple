import { z } from 'zod'
import { SORT_DIRECTIONS, cents, id, pagination } from './common'

const productFields = {
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120, 'Máximo 120 caracteres'),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Ingresá un código')
    .max(40, 'Máximo 40 caracteres')
    .regex(/^[A-Z0-9._-]+$/, 'Solo letras, números, punto, guion y guion bajo'),
  barcode: z
    .string()
    .trim()
    .regex(/^\d{8,14}$/, 'El código de barras tiene entre 8 y 14 dígitos')
    .nullable(),
  categoryId: id.nullable(),
  costCents: cents,
  priceCents: cents,
  minStock: z.number().int().min(0, 'No puede ser negativo').max(1_000_000),
}

export const createProductSchema = z.object({
  ...productFields,
  barcode: productFields.barcode.default(null),
  categoryId: productFields.categoryId.default(null),
  minStock: productFields.minStock.default(0),
  initialStock: z.number().int().min(0, 'No puede ser negativo').max(1_000_000).default(0),
})
export type CreateProductInput = z.input<typeof createProductSchema>
export type CreateProduct = z.infer<typeof createProductSchema>

export const updateProductSchema = z
  .object({ ...productFields, active: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'No hay cambios para guardar')
export type UpdateProductInput = z.infer<typeof updateProductSchema>

/** Columnas de la tabla de productos por las que se puede ordenar. `margin` requiere ver costos. */
export const PRODUCT_SORTS = ['name', 'category', 'price', 'margin', 'stock'] as const
export type ProductSort = (typeof PRODUCT_SORTS)[number]

/** Búsqueda exacta por código de barras o SKU (lector del punto de venta). */
export const productLookupQuerySchema = z.object({
  code: z.string().trim().max(80).default(''),
})
export type ProductLookupQuery = z.infer<typeof productLookupQuerySchema>

export const productQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  categoryId: id.optional(),
  stock: z.enum(['all', 'low', 'out']).default('all'),
  status: z.enum(['active', 'inactive', 'all']).default('active'),
  sort: z.enum(PRODUCT_SORTS).default('name'),
  dir: z.enum(SORT_DIRECTIONS).default('asc'),
  ...pagination,
})
export type ProductQuery = z.infer<typeof productQuerySchema>

/**
 * Mismos filtros que la lista, sin paginación ni orden: se exporta todo lo que coincide, siempre
 * ordenado por nombre (un orden que no cambia con las ventas que ocurran durante la descarga).
 */
export const productExportQuerySchema = productQuerySchema.omit({ sort: true, dir: true, page: true, pageSize: true })
export type ProductExportQuery = z.infer<typeof productExportQuerySchema>

/**
 * Encabezados del CSV de productos. Los usan la exportación, la plantilla y la importación: un archivo
 * exportado se puede editar en la planilla y volver a subir.
 */
export const PRODUCT_CSV_HEADERS = {
  sku: 'SKU',
  barcode: 'Código de barras',
  name: 'Nombre',
  category: 'Categoría',
  cost: 'Costo',
  price: 'Precio',
  stock: 'Stock',
  minStock: 'Stock mínimo',
  active: 'Activo',
} as const
export type ProductCsvField = keyof typeof PRODUCT_CSV_HEADERS

/** Límites de un archivo de importación: alcanzan para cualquier catálogo chico y no dejan tumbar el servidor. */
export const PRODUCT_IMPORT_MAX_BYTES = 2 * 1024 * 1024
export const PRODUCT_IMPORT_MAX_ROWS = 5_000

export interface ProductImportError {
  /** Fila de la planilla (el encabezado es la 1); null si el problema es del archivo entero. */
  row: number | null
  message: string
}

/** Un campo que cambia en un producto existente. Los montos van en centavos; vacío es null. */
export interface ProductImportChange {
  field: Exclude<ProductCsvField, 'sku' | 'stock'>
  before: string | number | boolean | null
  after: string | number | boolean | null
}

export interface ProductImportUpdate {
  row: number
  sku: string
  name: string
  changes: ProductImportChange[]
}

/**
 * Resultado de revisar un archivo antes de importarlo. No guarda nada. Cada fila se identifica por
 * SKU: si el producto existe se actualiza (salvo el stock, que se corrige con un conteo); si no, se crea.
 */
export interface ProductImportPreviewDto {
  /** Filas con datos (sin contar el encabezado). */
  rows: number
  toCreate: number
  toUpdate: number
  /** Productos existentes cuya fila es idéntica a lo que ya hay: no se tocan. */
  unchanged: number
  /** Categorías que no existen y se crearían. */
  newCategories: string[]
  /** Detalle de las actualizaciones, hasta un máximo; `toUpdate` dice cuántas hay en total. */
  updates: ProductImportUpdate[]
  /** Errores por fila, hasta un máximo; `errorCount` dice cuántos hay en total. */
  errors: ProductImportError[]
  errorCount: number
}

export interface ProductImportResultDto {
  created: number
  updated: number
  newCategories: string[]
}

export interface ProductDto {
  id: string
  sku: string
  barcode: string | null
  name: string
  category: { id: string; name: string } | null
  priceCents: number
  /** Solo presente para roles con permiso `products:view-cost`. */
  costCents?: number
  stock: number
  minStock: number
  active: boolean
  updatedAt: string
}

export function isLowStock(p: Pick<ProductDto, 'stock' | 'minStock'>): boolean {
  return p.stock <= p.minStock
}
