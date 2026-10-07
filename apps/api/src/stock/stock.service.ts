import { Injectable } from '@nestjs/common'
import type { Paginated, PriceChangeDto, StockAdjustmentInput, StockMovementDto } from '@stock/shared'
import type { RequestUser } from '../auth/auth.types'
import { AppError } from '../common/app-error'
import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra un movimiento manual. Cada cambio de stock queda en el libro de
   * movimientos (auditable) y el stock del producto se actualiza en la misma transacción.
   */
  async adjust(user: RequestUser, productId: string, input: StockAdjustmentInput): Promise<StockMovementDto> {
    const movement = await this.prisma.$transaction(async (tx) => {
      // FOR UPDATE bloquea la fila: una venta simultánea espera a que terminemos.
      const [product] = await tx.$queryRaw<{ stock: number; cost_cents: number; price_cents: number }[]>`
        SELECT stock, cost_cents, price_cents FROM products
        WHERE id = ${productId}::uuid AND business_id = ${user.businessId}::uuid
        FOR UPDATE`
      if (!product) throw AppError.notFound('El producto')

      const delta = this.deltaFor(input, product.stock)
      const stockAfter = product.stock + delta
      if (stockAfter < 0) {
        throw AppError.unprocessable('INSUFFICIENT_STOCK', `Solo hay ${product.stock} unidad(es) en stock`, { available: product.stock })
      }

      const newCost = input.type === 'PURCHASE' ? input.unitCostCents : undefined
      await tx.product.update({ where: { id: productId }, data: { stock: stockAfter, costCents: newCost } })

      if (newCost !== undefined && newCost !== product.cost_cents) {
        await tx.priceChange.create({
          data: {
            businessId: user.businessId,
            productId,
            userId: user.id,
            reason: 'PURCHASE',
            oldPriceCents: product.price_cents,
            newPriceCents: product.price_cents,
            oldCostCents: product.cost_cents,
            newCostCents: newCost,
          },
        })
      }

      return tx.stockMovement.create({
        data: {
          businessId: user.businessId,
          productId,
          userId: user.id,
          type: input.type,
          quantity: delta,
          stockAfter,
          note: input.note || null,
        },
        include: movementInclude,
      })
    })
    return toMovementDto(movement)
  }

  async movements(user: RequestUser, productId: string, page: number, pageSize = 20): Promise<Paginated<StockMovementDto>> {
    await this.assertProduct(user.businessId, productId)
    const where = { productId, businessId: user.businessId }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.stockMovement.count({ where }),
      this.prisma.stockMovement.findMany({
        where,
        include: movementInclude,
        // El id desempata movimientos con la misma fecha (ver ORDER_BY en products.service).
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])
    return { items: rows.map(toMovementDto), total, page, pageSize }
  }

  async priceHistory(user: RequestUser, productId: string): Promise<PriceChangeDto[]> {
    await this.assertProduct(user.businessId, productId)
    const rows = await this.prisma.priceChange.findMany({
      where: { productId, businessId: user.businessId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return rows.map((r) => ({
      id: r.id,
      oldPriceCents: r.oldPriceCents,
      newPriceCents: r.newPriceCents,
      oldCostCents: r.oldCostCents,
      newCostCents: r.newCostCents,
      reason: r.reason,
      user: r.user,
      createdAt: r.createdAt.toISOString(),
    }))
  }

  private deltaFor(input: StockAdjustmentInput, current: number): number {
    switch (input.type) {
      case 'PURCHASE':
        return input.quantity
      case 'LOSS':
        return -input.quantity
      case 'COUNT':
        return input.countedStock - current
    }
  }

  private async assertProduct(businessId: string, productId: string): Promise<void> {
    const exists = await this.prisma.product.findFirst({ where: { id: productId, businessId }, select: { id: true } })
    if (!exists) throw AppError.notFound('El producto')
  }
}

const movementInclude = {
  user: { select: { id: true, name: true } },
  sale: { select: { number: true } },
} satisfies Prisma.StockMovementInclude

type MovementRow = Prisma.StockMovementGetPayload<{ include: typeof movementInclude }>

function toMovementDto(m: MovementRow): StockMovementDto {
  return {
    id: m.id,
    type: m.type,
    quantity: m.quantity,
    stockAfter: m.stockAfter,
    note: m.note,
    saleNumber: m.sale?.number ?? null,
    user: m.user,
    createdAt: m.createdAt.toISOString(),
  }
}
