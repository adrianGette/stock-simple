import { Injectable } from '@nestjs/common'
import {
  type CreateSaleInput,
  type Paginated,
  type SaleDto,
  type SaleQuery,
  type SaleSummaryDto,
  type VoidSaleInput,
  can,
} from '@stock/shared'
import type { RequestUser } from '../auth/auth.types'
import { AppError } from '../common/app-error'
import { localDayRange } from '../common/dates'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { saleDetailInclude, saleSummaryInclude, toSaleDto, toSaleSummaryDto } from './sale.mapper'

interface ReservedProduct {
  id: string
  name: string
  sku: string
  price_cents: number
  cost_cents: number
  stock: number
}

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra una venta de forma atómica:
   * 1. Si la clave de idempotencia ya existe, devuelve la venta original (reintento del POS).
   * 2. Descuenta el stock con un UPDATE condicional (`stock >= cantidad`), así dos cajas
   *    vendiendo la última unidad al mismo tiempo nunca dejan el stock negativo.
   * 3. Toma precio y costo del mismo UPDATE ... RETURNING: la venta usa los valores vigentes
   *    en el instante exacto en que se reservó la mercadería.
   */
  async create(user: RequestUser, input: CreateSaleInput): Promise<SaleDto> {
    const existing = await this.findByIdempotencyKey(user, input.idempotencyKey)
    if (existing) return existing

    try {
      const saleId = await this.prisma.$transaction(async (tx) => {
        // Bloqueamos filas siempre en el mismo orden para evitar deadlocks entre ventas concurrentes.
        const items = input.items.toSorted((a, b) => a.productId.localeCompare(b.productId))
        const reserved: (ReservedProduct & { quantity: number })[] = []

        for (const item of items) {
          const [product] = await tx.$queryRaw<ReservedProduct[]>`
            UPDATE products SET stock = stock - ${item.quantity}, updated_at = now()
            WHERE id = ${item.productId}::uuid
              AND business_id = ${user.businessId}::uuid
              AND active = true
              AND stock >= ${item.quantity}
            RETURNING id, name, sku, price_cents, cost_cents, stock`
          if (!product) await this.explainRejectedItem(tx, user.businessId, item.productId, item.quantity)
          reserved.push({ ...product!, quantity: item.quantity })
        }

        const { saleCounter: number } = await tx.business.update({
          where: { id: user.businessId },
          data: { saleCounter: { increment: 1 } },
          select: { saleCounter: true },
        })

        const sale = await tx.sale.create({
          data: {
            businessId: user.businessId,
            number,
            userId: user.id,
            idempotencyKey: input.idempotencyKey,
            paymentMethod: input.paymentMethod,
            totalCents: reserved.reduce((sum, p) => sum + p.price_cents * p.quantity, 0),
            costCents: reserved.reduce((sum, p) => sum + p.cost_cents * p.quantity, 0),
            items: {
              create: reserved.map((p) => ({
                productId: p.id,
                productName: p.name,
                sku: p.sku,
                quantity: p.quantity,
                unitPriceCents: p.price_cents,
                unitCostCents: p.cost_cents,
                subtotalCents: p.price_cents * p.quantity,
              })),
            },
          },
          select: { id: true },
        })

        await tx.stockMovement.createMany({
          data: reserved.map((p) => ({
            businessId: user.businessId,
            productId: p.id,
            userId: user.id,
            saleId: sale.id,
            type: 'SALE' as const,
            quantity: -p.quantity,
            stockAfter: p.stock,
          })),
        })
        return sale.id
      })
      return this.get(user, saleId)
    } catch (error) {
      // Dos reintentos simultáneos con la misma clave: el segundo choca con el índice único.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const sale = await this.findByIdempotencyKey(user, input.idempotencyKey)
        if (sale) return sale
      }
      throw error
    }
  }

  async list(user: RequestUser, query: SaleQuery): Promise<Paginated<SaleSummaryDto>> {
    const where: Prisma.SaleWhereInput = {
      businessId: user.businessId,
      status: query.status === 'ALL' ? undefined : query.status,
      // Sin permiso para ver todas, cada cajero ve solo sus ventas.
      userId: can(user.role, 'sales:read-all') ? query.userId : user.id,
      createdAt: query.from || query.to ? localDayRange(query.from ?? '2000-01-01', query.to ?? '2100-01-01', user.timezone) : undefined,
    }
    const [total, sales] = await this.prisma.$transaction([
      this.prisma.sale.count({ where }),
      this.prisma.sale.findMany({
        where,
        include: saleSummaryInclude,
        orderBy: { number: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ])
    return { items: sales.map(toSaleSummaryDto), total, page: query.page, pageSize: query.pageSize }
  }

  async get(user: RequestUser, id: string): Promise<SaleDto> {
    const sale = await this.prisma.sale.findFirst({
      where: { id, businessId: user.businessId, userId: can(user.role, 'sales:read-all') ? undefined : user.id },
      include: saleDetailInclude,
    })
    if (!sale) throw AppError.notFound('La venta')
    return toSaleDto(sale, can(user.role, 'products:view-cost'))
  }

  /** Anula una venta y devuelve la mercadería al stock. La venta no se borra: queda para auditoría. */
  async void(user: RequestUser, id: string, { reason }: VoidSaleInput): Promise<SaleDto> {
    await this.prisma.$transaction(async (tx) => {
      const [sale] = await tx.$queryRaw<{ status: string }[]>`
        SELECT status FROM sales WHERE id = ${id}::uuid AND business_id = ${user.businessId}::uuid FOR UPDATE`
      if (!sale) throw AppError.notFound('La venta')
      if (sale.status === 'VOIDED') throw AppError.conflict('SALE_ALREADY_VOIDED', 'La venta ya estaba anulada')

      await tx.sale.update({ where: { id }, data: { status: 'VOIDED', voidedAt: new Date(), voidedById: user.id, voidReason: reason } })

      const items = await tx.saleItem.findMany({ where: { saleId: id }, orderBy: { productId: 'asc' } })
      for (const item of items) {
        const [product] = await tx.$queryRaw<{ stock: number }[]>`
          UPDATE products SET stock = stock + ${item.quantity}, updated_at = now()
          WHERE id = ${item.productId}::uuid RETURNING stock`
        await tx.stockMovement.create({
          data: {
            businessId: user.businessId,
            productId: item.productId,
            userId: user.id,
            saleId: id,
            type: 'SALE_VOID',
            quantity: item.quantity,
            stockAfter: product!.stock,
            note: reason,
          },
        })
      }
    })
    return this.get(user, id)
  }

  private async findByIdempotencyKey(user: RequestUser, idempotencyKey: string): Promise<SaleDto | null> {
    const sale = await this.prisma.sale.findUnique({
      where: { businessId_idempotencyKey: { businessId: user.businessId, idempotencyKey } },
      select: { id: true },
    })
    return sale ? this.get(user, sale.id) : null
  }

  /** Cuando el UPDATE condicional no afecta filas, averigua el motivo para dar un error claro. */
  private async explainRejectedItem(tx: Prisma.TransactionClient, businessId: string, productId: string, quantity: number): Promise<never> {
    const product = await tx.product.findFirst({ where: { id: productId, businessId }, select: { name: true, stock: true, active: true } })
    if (!product) throw AppError.notFound('Uno de los productos')
    if (!product.active) {
      throw AppError.unprocessable('PRODUCT_INACTIVE', `${product.name} está dado de baja`, { productId })
    }
    throw AppError.unprocessable(
      'INSUFFICIENT_STOCK',
      `No hay stock suficiente de ${product.name}: pediste ${quantity} y hay ${product.stock}`,
      { productId, requested: quantity, available: product.stock },
    )
  }
}
