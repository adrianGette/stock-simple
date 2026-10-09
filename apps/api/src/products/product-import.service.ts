import { randomUUID } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import {
  PRODUCT_CSV_HEADERS as H,
  type ProductImportError,
  type ProductImportPreviewDto,
  type ProductImportResultDto,
} from '@stock/shared'
import type { RequestUser } from '../auth/auth.types'
import { AppError } from '../common/app-error'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { type ImportRow, normalizeKey, readProductImport } from './product-import'

/** Cuántos errores se devuelven como máximo: con más, el archivo tiene un problema general. */
const MAX_ERRORS = 100

interface ImportPlan {
  preview: ProductImportPreviewDto
  rows: ImportRow[]
}

/**
 * Importación de productos nuevos en dos pasos sin estado: la vista previa valida y no guarda nada;
 * al confirmar, el archivo se vuelve a subir y se valida de nuevo, porque entre un paso y otro
 * alguien pudo haber creado un producto con el mismo SKU.
 */
@Injectable()
export class ProductImportService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(user: RequestUser, text: string): Promise<ProductImportPreviewDto> {
    return (await this.plan(user, text)).preview
  }

  async import(user: RequestUser, text: string): Promise<ProductImportResultDto> {
    const { preview, rows } = await this.plan(user, text)
    if (preview.errorCount > 0) {
      throw AppError.unprocessable('IMPORT_INVALID', 'El archivo tiene errores: no se importó nada.', preview)
    }

    try {
      // Todo o nada: si falla cualquier producto, no queda ni una categoría creada a medias.
      await this.prisma.$transaction(
        async (tx) => {
          await tx.category.createMany({ data: preview.newCategories.map((name) => ({ businessId: user.businessId, name })) })
          const categories = await tx.category.findMany({ where: { businessId: user.businessId }, select: { id: true, name: true } })
          const categoryIds = new Map(categories.map((category) => [normalizeKey(category.name), category.id]))

          const products = rows.map(({ product, categoryName, active }) => ({
            id: randomUUID(),
            businessId: user.businessId,
            sku: product.sku,
            barcode: product.barcode,
            name: product.name,
            categoryId: categoryName ? (categoryIds.get(normalizeKey(categoryName)) ?? null) : null,
            costCents: product.costCents,
            priceCents: product.priceCents,
            stock: product.initialStock,
            minStock: product.minStock,
            active,
          }))
          await tx.product.createMany({ data: products })
          // Igual que al crear un producto a mano: el stock inicial queda en el libro de movimientos.
          await tx.stockMovement.createMany({
            data: products
              .filter((product) => product.stock > 0)
              .map((product) => ({
                businessId: user.businessId,
                productId: product.id,
                userId: user.id,
                type: 'INITIAL' as const,
                quantity: product.stock,
                stockAfter: product.stock,
              })),
          })
        },
        { timeout: 30_000 },
      )
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw AppError.conflict(
          'CONFLICT',
          'Mientras importabas se creó un producto o una categoría con los mismos datos. Revisá el archivo de nuevo.',
        )
      }
      throw error
    }

    return { created: rows.length, newCategories: preview.newCategories }
  }

  private async plan(user: RequestUser, text: string): Promise<ImportPlan> {
    const file = readProductImport(text)
    const errors: ProductImportError[] = [...file.errors]

    // SKU y códigos de barras que ya usa el comercio: una sola consulta para todo el archivo.
    const skus = file.rows.map((r) => r.product.sku)
    const barcodes = file.rows.flatMap((r) => (r.product.barcode ? [r.product.barcode] : []))
    const taken = file.rows.length
      ? await this.prisma.product.findMany({
          where: { businessId: user.businessId, OR: [{ sku: { in: skus } }, { barcode: { in: barcodes } }] },
          select: { sku: true, barcode: true },
        })
      : []
    const takenSkus = new Set(taken.map((p) => p.sku))
    const takenBarcodes = new Set(taken.map((p) => p.barcode))

    const rows: ImportRow[] = []
    for (const row of file.rows) {
      const rowErrors: string[] = []
      if (takenSkus.has(row.product.sku)) rowErrors.push(`${H.sku}: ya existe un producto con el SKU ${row.product.sku}.`)
      if (row.product.barcode && takenBarcodes.has(row.product.barcode)) {
        rowErrors.push(`${H.barcode}: ya existe un producto con el código ${row.product.barcode}.`)
      }
      if (rowErrors.length > 0) errors.push(...rowErrors.map((message) => ({ row: row.row, message })))
      else rows.push(row)
    }

    // Categorías nuevas: las que no coinciden con una existente sin importar mayúsculas ni acentos.
    // Se crean con la forma en que aparecen por primera vez en el archivo.
    const existing = await this.prisma.category.findMany({ where: { businessId: user.businessId }, select: { name: true } })
    const known = new Set(existing.map((category) => normalizeKey(category.name)))
    const newCategories: string[] = []
    for (const { categoryName } of rows) {
      if (categoryName && !known.has(normalizeKey(categoryName))) {
        known.add(normalizeKey(categoryName))
        newCategories.push(categoryName)
      }
    }

    errors.sort((a, b) => (a.row ?? 0) - (b.row ?? 0))
    return {
      rows,
      preview: {
        rows: file.total,
        toCreate: rows.length,
        newCategories,
        errors: errors.slice(0, MAX_ERRORS),
        errorCount: errors.length,
      },
    }
  }
}
