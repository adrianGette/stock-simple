import {
  type CategoryDto,
  type CategoryInput,
  type CreateProductInput,
  PRODUCT_CSV_HEADERS as H,
  type Paginated,
  type PriceChangeDto,
  type ProductDto,
  type ProductImportPreviewDto,
  type ProductImportResultDto,
  type ProductQuery,
  type StockAdjustmentInput,
  type StockMovementDto,
  type UpdateProductInput,
  csvHeader,
  csvMoney,
  csvRow,
} from '@stock/shared'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, downloadFile, saveFile } from '../../lib/api-client'

export type ProductFilters = Partial<ProductQuery>

export const productKeys = {
  all: ['products'] as const,
  list: (filters: ProductFilters) => ['products', 'list', filters] as const,
  detail: (id: string) => ['products', 'detail', id] as const,
  movements: (id: string, page: number) => ['products', 'detail', id, 'movements', page] as const,
  priceHistory: (id: string) => ['products', 'detail', id, 'price-history'] as const,
  categories: ['categories'] as const,
}

export function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: productKeys.list(filters),
    queryFn: ({ signal }) => api<Paginated<ProductDto>>('/products', { query: filters, signal }),
    // Mientras llega la página nueva se mantiene la anterior: sin saltos de layout.
    placeholderData: keepPreviousData,
  })
}

/** Descarga el CSV con los mismos filtros que la lista (sin paginación: trae todo lo que coincide). */
export function exportProducts({ q, stock, categoryId, status }: ProductFilters) {
  return downloadFile('/products/export', { query: { q, stock, categoryId, status } })
}

export function useProduct(id: string) {
  return useQuery({ queryKey: productKeys.detail(id), queryFn: ({ signal }) => api<ProductDto>(`/products/${id}`, { signal }) })
}

export function lookupProduct(code: string) {
  return api<ProductDto>('/products/lookup', { query: { code } })
}

export function useMovements(id: string, page: number, enabled = true) {
  return useQuery({
    queryKey: productKeys.movements(id, page),
    queryFn: ({ signal }) => api<Paginated<StockMovementDto>>(`/products/${id}/movements`, { query: { page }, signal }),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function usePriceHistory(id: string, enabled = true) {
  return useQuery({
    queryKey: productKeys.priceHistory(id),
    queryFn: ({ signal }) => api<PriceChangeDto[]>(`/products/${id}/price-history`, { signal }),
    enabled,
  })
}

export function useCategories() {
  return useQuery({
    queryKey: productKeys.categories,
    queryFn: ({ signal }) => api<CategoryDto[]>('/categories', { signal }),
    staleTime: 5 * 60_000,
  })
}

function useInvalidateProducts() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: productKeys.all }),
      queryClient.invalidateQueries({ queryKey: productKeys.categories }),
      queryClient.invalidateQueries({ queryKey: ['reports'] }),
    ])
}

export function useSaveProduct(id?: string) {
  const invalidate = useInvalidateProducts()
  return useMutation({
    mutationFn: (input: CreateProductInput | UpdateProductInput) =>
      id ? api<ProductDto>(`/products/${id}`, { method: 'PATCH', body: input }) : api<ProductDto>('/products', { method: 'POST', body: input }),
    onSuccess: invalidate,
  })
}

export function useAdjustStock(productId: string) {
  const invalidate = useInvalidateProducts()
  return useMutation({
    mutationFn: (input: StockAdjustmentInput) =>
      api<StockMovementDto>(`/products/${productId}/stock-adjustments`, { method: 'POST', body: input }),
    onSuccess: invalidate,
  })
}

export function useSaveCategory() {
  const invalidate = useInvalidateProducts()
  return useMutation({
    mutationFn: ({ id, ...input }: CategoryInput & { id?: string }) =>
      id
        ? api<CategoryDto>(`/categories/${id}`, { method: 'PATCH', body: input })
        : api<CategoryDto>('/categories', { method: 'POST', body: input }),
    onSuccess: invalidate,
  })
}

export function useDeleteCategory() {
  const invalidate = useInvalidateProducts()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/categories/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}

/**
 * El archivo se manda siempre como text/csv: según el sistema y los programas instalados, el
 * navegador lo etiqueta distinto (en Windows con Excel, "application/vnd.ms-excel").
 */
const asCsv = (file: File) => new Blob([file], { type: 'text/csv' })

export function previewProductImport(file: File) {
  return api<ProductImportPreviewDto>('/products/import/preview', { method: 'POST', body: asCsv(file) })
}

export function useImportProducts() {
  const invalidate = useInvalidateProducts()
  return useMutation({
    mutationFn: (file: File) => api<ProductImportResultDto>('/products/import', { method: 'POST', body: asCsv(file) }),
    onSuccess: invalidate,
  })
}

/** Plantilla de importación: mismas columnas que la exportación y una fila de ejemplo. */
export function downloadImportTemplate() {
  const header = csvHeader(Object.values(H).map((name) => ({ header: name, value: () => null })))
  const example = csvRow(['REM-01', '7790001234567', 'Remera negra · M', 'Remeras', csvMoney(2_000_000), csvMoney(3_990_000), 10, 2, true])
  saveFile(new Blob([header + example], { type: 'text/csv;charset=utf-8' }), 'plantilla-productos.csv')
}
