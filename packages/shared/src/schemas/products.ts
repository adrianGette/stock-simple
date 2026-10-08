import { z } from 'zod'
import { cents, id, pagination } from './common'

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

export const PRODUCT_SORTS = ['name', 'stock', 'price', 'updated'] as const

export const productQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  categoryId: id.optional(),
  stock: z.enum(['all', 'low', 'out']).default('all'),
  status: z.enum(['active', 'inactive', 'all']).default('active'),
  sort: z.enum(PRODUCT_SORTS).default('name'),
  ...pagination,
})
export type ProductQuery = z.infer<typeof productQuerySchema>

/**
 * Mismos filtros que la lista, sin paginación ni orden: se exporta todo lo que coincide, siempre
 * ordenado por nombre (un orden que no cambia con las ventas que ocurran durante la descarga).
 */
export const productExportQuerySchema = productQuerySchema.omit({ sort: true, page: true, pageSize: true })
export type ProductExportQuery = z.infer<typeof productExportQuerySchema>

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
