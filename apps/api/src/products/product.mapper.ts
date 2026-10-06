import type { ProductDto } from '@stock/shared'
import type { Category, Product } from '../generated/prisma/client'

export type ProductWithCategory = Product & { category: Pick<Category, 'id' | 'name'> | null }

/** El costo solo se incluye si el rol puede verlo: nunca llega al navegador de un cajero. */
export function toProductDto(product: ProductWithCategory, includeCost: boolean): ProductDto {
  return {
    id: product.id,
    sku: product.sku,
    barcode: product.barcode,
    name: product.name,
    category: product.category ? { id: product.category.id, name: product.category.name } : null,
    priceCents: product.priceCents,
    ...(includeCost && { costCents: product.costCents }),
    stock: product.stock,
    minStock: product.minStock,
    active: product.active,
    updatedAt: product.updatedAt.toISOString(),
  }
}
