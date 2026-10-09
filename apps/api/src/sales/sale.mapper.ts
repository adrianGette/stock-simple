import type { SaleDto, SaleSummaryDto } from '@stock/shared'
import type { Prisma } from '../generated/prisma/client'
import { toUserRef, userRefSelect } from '../users/user-ref'

export const saleSummaryInclude = {
  user: { select: userRefSelect },
  _count: { select: { items: true } },
} satisfies Prisma.SaleInclude

export const saleDetailInclude = {
  user: { select: userRefSelect },
  voidedBy: { select: userRefSelect },
  items: { orderBy: { productName: 'asc' } },
  _count: { select: { items: true } },
} satisfies Prisma.SaleInclude

type SaleSummaryRow = Prisma.SaleGetPayload<{ include: typeof saleSummaryInclude }>
type SaleDetailRow = Prisma.SaleGetPayload<{ include: typeof saleDetailInclude }>

export function toSaleSummaryDto(sale: SaleSummaryRow): SaleSummaryDto {
  return {
    id: sale.id,
    number: sale.number,
    status: sale.status,
    paymentMethod: sale.paymentMethod,
    totalCents: sale.totalCents,
    itemCount: sale._count.items,
    user: toUserRef(sale.user),
    createdAt: sale.createdAt.toISOString(),
  }
}

export function toSaleDto(sale: SaleDetailRow, includeCost: boolean): SaleDto {
  return {
    ...toSaleSummaryDto(sale),
    ...(includeCost && { costCents: sale.costCents }),
    items: sale.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      subtotalCents: item.subtotalCents,
      ...(includeCost && { unitCostCents: item.unitCostCents }),
    })),
    voidedAt: sale.voidedAt?.toISOString() ?? null,
    voidReason: sale.voidReason,
    voidedBy: sale.voidedBy ? toUserRef(sale.voidedBy) : null,
  }
}
