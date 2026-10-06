import type { CreateSaleInput, Paginated, SaleDto, SaleQuery, SaleSummaryDto, VoidSaleInput } from '@stock/shared'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api-client'
import { productKeys } from '../products/api'

export type SaleFilters = Partial<SaleQuery>

export const saleKeys = {
  all: ['sales'] as const,
  list: (filters: SaleFilters) => ['sales', 'list', filters] as const,
  detail: (id: string) => ['sales', 'detail', id] as const,
}

export function useSales(filters: SaleFilters) {
  return useQuery({
    queryKey: saleKeys.list(filters),
    queryFn: ({ signal }) => api<Paginated<SaleSummaryDto>>('/sales', { query: filters, signal }),
    placeholderData: keepPreviousData,
  })
}

export function useSale(id: string | null) {
  return useQuery({
    queryKey: saleKeys.detail(id ?? ''),
    queryFn: ({ signal }) => api<SaleDto>(`/sales/${id}`, { signal }),
    enabled: Boolean(id),
  })
}

function useInvalidateAfterSale() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: saleKeys.all }),
      queryClient.invalidateQueries({ queryKey: productKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['reports'] }),
    ])
}

export function useCreateSale() {
  const invalidate = useInvalidateAfterSale()
  return useMutation({
    mutationFn: (input: CreateSaleInput) => api<SaleDto>('/sales', { method: 'POST', body: input }),
    onSettled: invalidate,
  })
}

export function useVoidSale(id: string) {
  const invalidate = useInvalidateAfterSale()
  return useMutation({
    mutationFn: (input: VoidSaleInput) => api<SaleDto>(`/sales/${id}/void`, { method: 'POST', body: input }),
    onSuccess: invalidate,
  })
}
