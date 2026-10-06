import { randomUUID } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import {
  type BulkPriceUpdate,
  type PricePreviewDto,
  type PricePreviewRow,
  type PriceUpdateResultDto,
  adjustAmount,
  marginPercent,
} from '@stock/shared'
import type { RequestUser } from '../auth/auth.types'
import { AppError } from '../common/app-error'
import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

type Db = Prisma.TransactionClient | PrismaService

/**
 * Actualización masiva de precios, el caso de uso estrella en contexto inflacionario:
 * "subí 8 % todas las remeras y redondeá a $100". Primero se previsualiza, después se aplica.
 * Ambas operaciones usan `adjustAmount` de @stock/shared, la misma función que muestra la web.
 */
@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(user: RequestUser, input: BulkPriceUpdate): Promise<PricePreviewDto> {
    const rows = await this.computeRows(this.prisma, user.businessId, input)
    return { rows, count: rows.length }
  }

  async apply(user: RequestUser, input: BulkPriceUpdate): Promise<PriceUpdateResultDto> {
    const batchId = randomUUID()
    const updated = await this.prisma.$transaction(async (tx) => {
      // Se recalcula dentro de la transacción sobre valores frescos: si alguien cambió
      // un precio entre la vista previa y la confirmación, no se pisa con un dato viejo.
      const rows = (await this.computeRows(tx, user.businessId, input, true)).filter(
        (r) => r.newPriceCents !== r.oldPriceCents || r.newCostCents !== r.oldCostCents,
      )
      for (const row of rows) {
        await tx.product.update({ where: { id: row.productId }, data: { priceCents: row.newPriceCents, costCents: row.newCostCents } })
      }
      await tx.priceChange.createMany({
        data: rows.map((r) => ({
          businessId: user.businessId,
          productId: r.productId,
          userId: user.id,
          batchId,
          reason: 'BULK' as const,
          oldPriceCents: r.oldPriceCents,
          newPriceCents: r.newPriceCents,
          oldCostCents: r.oldCostCents,
          newCostCents: r.newCostCents,
        })),
      })
      return rows.length
    })
    return { batchId, updated }
  }

  private async computeRows(db: Db, businessId: string, input: BulkPriceUpdate, lock = false): Promise<PricePreviewRow[]> {
    if (input.categoryId) {
      const category = await db.category.findFirst({ where: { id: input.categoryId, businessId }, select: { id: true } })
      if (!category) throw AppError.notFound('La categoría')
    }
    const where: Prisma.ProductWhereInput = {
      businessId,
      active: true,
      categoryId: input.categoryId ?? undefined,
      id: input.productIds ? { in: input.productIds } : undefined,
    }
    if (lock) {
      // Bloquea los productos afectados (en orden estable) hasta terminar la transacción.
      const ids = (await db.product.findMany({ where, select: { id: true }, orderBy: { id: 'asc' } })).map((p) => p.id)
      if (ids.length) await db.$executeRaw`SELECT 1 FROM products WHERE id = ANY(${ids}::uuid[]) ORDER BY id FOR UPDATE`
    }
    const products = await db.product.findMany({
      where,
      include: { category: { select: { name: true } } },
      orderBy: { name: 'asc' },
    })

    const adjustment = { percent: input.percent, roundTo: input.roundTo, direction: input.direction }
    return products.map((p) => {
      const newPriceCents = input.target === 'cost' ? p.priceCents : adjustAmount(p.priceCents, adjustment)
      // El costo no se redondea a pasos comerciales: se mantiene exacto al centavo.
      const newCostCents =
        input.target === 'price' ? p.costCents : adjustAmount(p.costCents, { ...adjustment, roundTo: 1, direction: 'nearest' })
      return {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category?.name ?? null,
        oldPriceCents: p.priceCents,
        newPriceCents,
        oldCostCents: p.costCents,
        newCostCents,
        oldMargin: marginPercent(p.costCents, p.priceCents),
        newMargin: marginPercent(newCostCents, newPriceCents),
      }
    })
  }
}
