import { randomUUID } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import {
  PRODUCT_CSV_HEADERS as H,
  type ProductImportChange,
  type ProductImportError,
  type ProductImportPreviewDto,
  type ProductImportResultDto,
  type ProductImportUpdate,
} from '@stock/shared'
import type { RequestUser } from '../auth/auth.types'
import { AppError } from '../common/app-error'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type { ProductWithCategory } from './product.mapper'
import { type ImportRow, normalizeKey, readProductImport } from './product-import'

/** Cuántos errores y actualizaciones se detallan como máximo: con más, ya no se leen uno por uno. */
const MAX_DETAILS = 100

interface PlannedUpdate {
  row: ImportRow
  current: ProductWithCategory
  changes: ProductImportChange[]
}

interface ImportPlan {
  preview: ProductImportPreviewDto
  creates: ImportRow[]
  updates: PlannedUpdate[]
}

/** Lo que cambia entre el producto guardado y su fila del archivo. El stock no se compara: se corrige con un conteo. */
function diff(current: ProductWithCategory, { product, categoryName, active }: ImportRow): ProductImportChange[] {
  const changes: ProductImportChange[] = []
  const add = (field: ProductImportChange['field'], before: ProductImportChange['before'], after: ProductImportChange['after']) => {
    if (before !== after) changes.push({ field, before, after })
  }
  add('name', current.name, product.name)
  add('barcode', current.barcode, product.barcode)
  // "remeras" en el archivo es la misma categoría que "Remeras": no es un cambio.
  const currentCategory = current.category?.name ?? null
  if (normalizeKey(currentCategory ?? '') !== normalizeKey(categoryName ?? '')) add('category', currentCategory, categoryName)
  add('cost', current.costCents, product.costCents)
  add('price', current.priceCents, product.priceCents)
  add('minStock', current.minStock, product.minStock)
  add('active', current.active, active)
  return changes
}

/**
 * Importación de productos en dos pasos sin estado. Cada fila se identifica por SKU: si el producto
 * existe se actualiza (salvo el stock) y si no, se crea. La vista previa valida y no guarda nada; al
 * confirmar, el archivo se vuelve a subir y se valida de nuevo, porque entre un paso y otro alguien
 * pudo haber cambiado los productos.
 */
@Injectable()
export class ProductImportService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(user: RequestUser, text: string): Promise<ProductImportPreviewDto> {
    return (await this.plan(user, text)).preview
  }

  async import(user: RequestUser, text: string): Promise<ProductImportResultDto> {
    const { preview, creates, updates } = await this.plan(user, text)
    if (preview.errorCount > 0) {
      throw AppError.unprocessable('IMPORT_INVALID', 'El archivo tiene errores: no se guardó nada.', preview)
    }

    try {
      // Todo o nada: si falla cualquier producto, no queda ni una categoría creada a medias.
      await this.prisma.$transaction(
        async (tx) => {
          await tx.category.createMany({ data: preview.newCategories.map((name) => ({ businessId: user.businessId, name })) })
          const categories = await tx.category.findMany({ where: { businessId: user.businessId }, select: { id: true, name: true } })
          const categoryIds = new Map(categories.map((category) => [normalizeKey(category.name), category.id]))
          const categoryId = (name: string | null) => (name ? (categoryIds.get(normalizeKey(name)) ?? null) : null)

          // Primero se liberan los códigos de barras que cambian: si el archivo intercambia los códigos de
          // dos productos, el resultado es válido, pero guardándolos de a uno chocarían por un instante.
          const barcodeChanges = updates.filter((u) => u.changes.some((c) => c.field === 'barcode'))
          if (barcodeChanges.length > 0) {
            await tx.product.updateMany({ where: { id: { in: barcodeChanges.map((u) => u.current.id) } }, data: { barcode: null } })
          }

          const created = creates.map(({ product, categoryName, active }) => ({
            id: randomUUID(),
            businessId: user.businessId,
            sku: product.sku,
            barcode: product.barcode,
            name: product.name,
            categoryId: categoryId(categoryName),
            costCents: product.costCents,
            priceCents: product.priceCents,
            stock: product.initialStock,
            minStock: product.minStock,
            active,
          }))
          await tx.product.createMany({ data: created })
          // Igual que al crear un producto a mano: el stock inicial queda en el libro de movimientos.
          await tx.stockMovement.createMany({
            data: created
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

          // Solo los productos que cambian: una fila idéntica no toca el producto ni su fecha de actualización.
          for (const { row, current } of updates) {
            await tx.product.update({
              where: { id: current.id },
              data: {
                name: row.product.name,
                barcode: row.product.barcode,
                categoryId: categoryId(row.categoryName),
                costCents: row.product.costCents,
                priceCents: row.product.priceCents,
                minStock: row.product.minStock,
                active: row.active,
              },
            })
          }

          // Los cambios de precio o costo van al historial, agrupados como un cambio masivo.
          const batchId = randomUUID()
          await tx.priceChange.createMany({
            data: updates
              .filter(({ row, current }) => row.product.priceCents !== current.priceCents || row.product.costCents !== current.costCents)
              .map(({ row, current }) => ({
                businessId: user.businessId,
                productId: current.id,
                userId: user.id,
                batchId,
                reason: 'BULK' as const,
                oldPriceCents: current.priceCents,
                newPriceCents: row.product.priceCents,
                oldCostCents: current.costCents,
                newCostCents: row.product.costCents,
              })),
          })
        },
        { timeout: 60_000 },
      )
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw AppError.conflict('CONFLICT', 'Mientras importabas alguien cambió productos o categorías. Revisá el archivo de nuevo.')
      }
      throw error
    }

    return { created: creates.length, updated: updates.length, newCategories: preview.newCategories }
  }

  private async plan(user: RequestUser, text: string): Promise<ImportPlan> {
    const file = readProductImport(text)
    const errors: ProductImportError[] = [...file.errors]
    const skus = file.rows.map((r) => r.product.sku)
    const barcodes = file.rows.flatMap((r) => (r.product.barcode ? [r.product.barcode] : []))

    // Productos existentes con esos SKU, y dueños actuales de esos códigos de barras: dos consultas para todo el archivo.
    const [existing, barcodeOwners, categories] = await Promise.all([
      file.rows.length
        ? this.prisma.product.findMany({
            where: { businessId: user.businessId, sku: { in: skus } },
            include: { category: { select: { id: true, name: true } } },
          })
        : [],
      barcodes.length
        ? this.prisma.product.findMany({ where: { businessId: user.businessId, barcode: { in: barcodes } }, select: { sku: true, barcode: true } })
        : [],
      this.prisma.category.findMany({ where: { businessId: user.businessId }, select: { name: true } }),
    ])
    const bySku = new Map(existing.map((product) => [product.sku, product]))
    const ownerByBarcode = new Map(barcodeOwners.map((product) => [product.barcode, product.sku]))
    const skusInFile = new Set(skus)

    const creates: ImportRow[] = []
    const updates: PlannedUpdate[] = []
    let unchanged = 0
    for (const row of file.rows) {
      const owner = row.product.barcode ? ownerByBarcode.get(row.product.barcode) : undefined
      // El código lo tiene otro producto que no está en el archivo. Si está, ese producto cambia de código
      // (si lo conservara, el archivo tendría el código repetido y ya habría un error de esa fila).
      if (owner && owner !== row.product.sku && !skusInFile.has(owner)) {
        errors.push({ row: row.row, message: `${H.barcode}: ya lo usa el producto ${owner}.` })
        continue
      }
      const current = bySku.get(row.product.sku)
      if (!current) creates.push(row)
      else {
        const changes = diff(current, row)
        if (changes.length > 0) updates.push({ row, current, changes })
        else unchanged++
      }
    }

    // Categorías nuevas: las que no coinciden con una existente sin importar mayúsculas ni acentos.
    // Se crean con la forma en que aparecen por primera vez en el archivo.
    const known = new Set(categories.map((category) => normalizeKey(category.name)))
    const newCategories: string[] = []
    for (const { categoryName } of [...creates, ...updates.map((u) => u.row)].toSorted((a, b) => a.row - b.row)) {
      if (categoryName && !known.has(normalizeKey(categoryName))) {
        known.add(normalizeKey(categoryName))
        newCategories.push(categoryName)
      }
    }

    errors.sort((a, b) => (a.row ?? 0) - (b.row ?? 0))
    const details: ProductImportUpdate[] = updates
      .slice(0, MAX_DETAILS)
      .map(({ row, changes }) => ({ row: row.row, sku: row.product.sku, name: row.product.name, changes }))
    return {
      creates,
      updates,
      preview: {
        rows: file.total,
        toCreate: creates.length,
        toUpdate: updates.length,
        unchanged,
        newCategories,
        updates: details,
        errors: errors.slice(0, MAX_DETAILS),
        errorCount: errors.length,
      },
    }
  }
}
