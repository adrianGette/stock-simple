import { type CsvColumn, csvMoney } from '@stock/shared'
import type { ProductWithCategory } from './product.mapper'

/** Columnas del CSV de productos. El costo solo se incluye si el rol puede verlo, igual que en la API. */
export function productCsvColumns(includeCost: boolean): CsvColumn<ProductWithCategory>[] {
  return [
    { header: 'SKU', value: (p) => p.sku },
    { header: 'Código de barras', value: (p) => p.barcode },
    { header: 'Nombre', value: (p) => p.name },
    { header: 'Categoría', value: (p) => p.category?.name },
    ...(includeCost ? [{ header: 'Costo', value: (p: ProductWithCategory) => csvMoney(p.costCents) }] : []),
    { header: 'Precio', value: (p) => csvMoney(p.priceCents) },
    { header: 'Stock', value: (p) => p.stock },
    { header: 'Stock mínimo', value: (p) => p.minStock },
    { header: 'Activo', value: (p) => p.active },
  ]
}
