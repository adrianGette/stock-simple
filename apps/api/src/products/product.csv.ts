import { type CsvColumn, PRODUCT_CSV_HEADERS as H, csvMoney } from '@stock/shared'
import type { ProductWithCategory } from './product.mapper'

/** Columnas del CSV de productos. El costo solo se incluye si el rol puede verlo, igual que en la API. */
export function productCsvColumns(includeCost: boolean): CsvColumn<ProductWithCategory>[] {
  return [
    { header: H.sku, value: (p) => p.sku },
    { header: H.barcode, value: (p) => p.barcode },
    { header: H.name, value: (p) => p.name },
    { header: H.category, value: (p) => p.category?.name },
    ...(includeCost ? [{ header: H.cost, value: (p: ProductWithCategory) => csvMoney(p.costCents) }] : []),
    { header: H.price, value: (p) => csvMoney(p.priceCents) },
    { header: H.stock, value: (p) => p.stock },
    { header: H.minStock, value: (p) => p.minStock },
    { header: H.active, value: (p) => p.active },
  ]
}
