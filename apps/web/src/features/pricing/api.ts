import type { BulkPriceUpdateInput, PricePreviewDto, PriceUpdateResultDto } from '@stock/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api-client'
import { productKeys } from '../products/api'

export function usePricePreview() {
  return useMutation({
    mutationFn: (input: BulkPriceUpdateInput) => api<PricePreviewDto>('/prices/preview', { method: 'POST', body: input }),
  })
}

export function useApplyPrices() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: BulkPriceUpdateInput) => api<PriceUpdateResultDto>('/prices/apply', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  })
}
