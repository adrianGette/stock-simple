import { Injectable } from '@nestjs/common'
import {
  COUNT_CSV_HEADERS as C,
  type InventoryCountLine,
  type InventoryCountPreviewDto,
  type InventoryCountResultDto,
} from '@stock/shared'
import type { RequestUser } from '../auth/auth.types'
import { AppError } from '../common/app-error'
import { PrismaService } from '../prisma/prisma.service'
import { readInventoryCount } from './inventory-count'

/** Cuántas líneas y errores se detallan como máximo. */
const MAX_DETAILS = 100

interface CountPlan {
  preview: InventoryCountPreviewDto
  /** Productos con diferencia, con su id para aplicarla. */
  adjustments: (InventoryCountLine & { productId: string })[]
}

/**
 * Conteo de inventario desde una planilla, en dos pasos sin estado como la importación.
 *
 * La diferencia se calcula contra el stock que tenía el sistema al descargar la planilla (no contra
 * el actual) y se aplica sobre el actual: si se vendió algo mientras se contaba, esa venta ya salió
 * del local y del sistema, y no hay que volver a descontarla ni sumarla.
 */
@Injectable()
export class InventoryCountService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(user: RequestUser, text: string): Promise<InventoryCountPreviewDto> {
    return (await this.plan(user, text)).preview
  }

  async apply(user: RequestUser, text: string): Promise<InventoryCountResultDto> {
    const { preview, adjustments } = await this.plan(user, text)
    if (preview.errorCount > 0) {
      throw AppError.unprocessable('IMPORT_INVALID', 'La planilla tiene errores: no se ajustó nada.', preview)
    }
    if (adjustments.length === 0) return { adjusted: 0 }

    await this.prisma.$transaction(
      async (tx) => {
        // FOR UPDATE bloquea las filas (en orden de id, como las ventas, para no trabarse entre sí): una
        // venta simultánea espera, y el stock final se calcula sobre el valor que realmente queda.
        const ids = adjustments.map((line) => line.productId)
        const locked = await tx.$queryRaw<{ id: string; stock: number }[]>`
          SELECT id, stock FROM products
          WHERE id = ANY(${ids}::uuid[]) AND business_id = ${user.businessId}::uuid
          ORDER BY id
          FOR UPDATE`
        const stockById = new Map(locked.map((product) => [product.id, product.stock]))

        for (const line of adjustments) {
          const stockAfter = (stockById.get(line.productId) ?? 0) + line.difference
          if (stockAfter < 0) {
            throw AppError.unprocessable(
              'INSUFFICIENT_STOCK',
              `${line.sku}: con las ventas de estos minutos el stock quedaría en ${stockAfter}. Volvé a revisar la planilla.`,
            )
          }
          await tx.product.update({ where: { id: line.productId }, data: { stock: stockAfter } })
          await tx.stockMovement.create({
            data: {
              businessId: user.businessId,
              productId: line.productId,
              userId: user.id,
              type: 'COUNT',
              quantity: line.difference,
              stockAfter,
              note: `Conteo por planilla: había ${line.systemStock}, se contaron ${line.counted}`,
            },
          })
        }
      },
      { timeout: 60_000 },
    )
    return { adjusted: adjustments.length }
  }

  private async plan(user: RequestUser, text: string): Promise<CountPlan> {
    const file = readInventoryCount(text)
    const errors = [...file.errors]

    const products = file.rows.length
      ? await this.prisma.product.findMany({
          where: { businessId: user.businessId, sku: { in: file.rows.map((r) => r.sku) } },
          select: { id: true, sku: true, name: true, stock: true },
        })
      : []
    const bySku = new Map(products.map((product) => [product.sku, product]))

    const lines: (InventoryCountLine & { productId: string })[] = []
    let matching = 0
    let movedSince = 0
    for (const row of file.rows) {
      const product = bySku.get(row.sku)
      if (!product) {
        errors.push({ row: row.row, message: `${C.sku}: no existe un producto con el SKU ${row.sku}.` })
        continue
      }
      const difference = row.counted - row.systemStock
      const stockAfter = product.stock + difference
      if (stockAfter < 0) {
        errors.push({
          row: row.row,
          message: `${C.counted}: con los movimientos posteriores a la planilla el stock quedaría en ${stockAfter}. Volvé a contar este producto.`,
        })
        continue
      }
      const moved = product.stock !== row.systemStock
      if (moved) movedSince++
      if (difference === 0) matching++
      if (difference !== 0 || moved) {
        lines.push({
          productId: product.id,
          row: row.row,
          sku: row.sku,
          name: product.name,
          systemStock: row.systemStock,
          currentStock: product.stock,
          counted: row.counted,
          difference,
          stockAfter,
        })
      }
    }

    errors.sort((a, b) => (a.row ?? 0) - (b.row ?? 0))
    const adjustments = lines.filter((line) => line.difference !== 0)
    return {
      adjustments,
      preview: {
        rows: file.total,
        toAdjust: adjustments.length,
        matching,
        skipped: file.skipped,
        movedSince,
        lines: lines.slice(0, MAX_DETAILS).map(({ productId: _id, ...line }) => line),
        errors: errors.slice(0, MAX_DETAILS),
        errorCount: errors.length,
      },
    }
  }
}
