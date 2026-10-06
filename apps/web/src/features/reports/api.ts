import type { DashboardDto, ReportRange, SalesReportDto } from '@stock/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api-client'

export const reportKeys = {
  dashboard: ['reports', 'dashboard'] as const,
  sales: (range: ReportRange) => ['reports', 'sales', range] as const,
}

export function useDashboard() {
  return useQuery({
    queryKey: reportKeys.dashboard,
    queryFn: ({ signal }) => api<DashboardDto>('/reports/dashboard', { signal }),
    // El tablero queda abierto en el mostrador: se refresca solo cada minuto.
    refetchInterval: 60_000,
  })
}

export function useSalesReport(range: ReportRange) {
  return useQuery({
    queryKey: reportKeys.sales(range),
    queryFn: ({ signal }) => api<SalesReportDto>('/reports/sales', { query: { ...range }, signal }),
    placeholderData: keepPreviousData,
  })
}
