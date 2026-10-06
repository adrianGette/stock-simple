import type {
  CategoryDto,
  CategoryInput,
  CreateProductInput,
  Paginated,
  PriceChangeDto,
  ProductDto,
  ProductQuery,
  StockAdjustmentInput,
  StockMovementDto,
  UpdateProductInput,
} from '@stock/shared'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api-client'

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
