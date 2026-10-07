import { Injectable } from '@nestjs/common'
import {
  type CreateProduct,
  type Paginated,
  type ProductDto,
  type ProductQuery,
  type UpdateProductInput,
  can,
} from '@stock/shared'
import type { RequestUser } from '../auth/auth.types'
import { AppError } from '../common/app-error'
import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { toProductDto } from './product.mapper'

// El id al final desempata: sin un orden total, Postgres puede ordenar distinto los empates
// en cada consulta y la paginación por offset repite o saltea productos.
const ORDER_BY: Record<ProductQuery['sort'], Prisma.ProductOrderByWithRelationInput[]> = {
  name: [{ name: 'asc' }, { id: 'asc' }],
  stock: [{ stock: 'asc' }, { name: 'asc' }, { id: 'asc' }],
  price: [{ priceCents: 'desc' }, { name: 'asc' }, { id: 'asc' }],
  updated: [{ updatedAt: 'desc' }, { id: 'asc' }],
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: RequestUser, query: ProductQuery): Promise<Paginated<ProductDto>> {
    const fields = this.prisma.product.fields
    const where: Prisma.ProductWhereInput = {
      businessId: user.businessId,
      categoryId: query.categoryId,
      active: query.status === 'all' ? undefined : query.status === 'active',
      // Comparación entre columnas (stock <= minStock) resuelta en la base, no en memoria.
      stock: query.stock === 'low' ? { lte: fields.minStock } : query.stock === 'out' ? { lte: 0 } : undefined,
      OR: query.q
        ? [
            { name: { contains: query.q, mode: 'insensitive' } },
            { sku: { contains: query.q, mode: 'insensitive' } },
            { barcode: query.q },
          ]
        : undefined,
    }

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy: ORDER_BY[query.sort],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ])

    const includeCost = can(user.role, 'products:view-cost')
    return { items: products.map((p) => toProductDto(p, includeCost)), total, page: query.page, pageSize: query.pageSize }
  }

  async get(user: RequestUser, id: string): Promise<ProductDto> {
    const product = await this.prisma.product.findFirst({
      where: { id, businessId: user.businessId },
      include: { category: { select: { id: true, name: true } } },
    })
    if (!product) throw AppError.notFound('El producto')
    return toProductDto(product, can(user.role, 'products:view-cost'))
  }

  /** Búsqueda exacta por código de barras o SKU, pensada para el lector del punto de venta. */
  async lookup(user: RequestUser, code: string): Promise<ProductDto> {
    const normalized = code.trim()
    const product = await this.prisma.product.findFirst({
      where: { businessId: user.businessId, active: true, OR: [{ barcode: normalized }, { sku: normalized.toUpperCase() }] },
      include: { category: { select: { id: true, name: true } } },
    })
    if (!product) throw AppError.notFound(`El código ${normalized}`)
    return toProductDto(product, can(user.role, 'products:view-cost'))
  }

  async create(user: RequestUser, input: CreateProduct): Promise<ProductDto> {
    await this.assertUnique(user.businessId, { sku: input.sku, barcode: input.barcode })
    await this.assertCategory(user.businessId, input.categoryId)

    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          businessId: user.businessId,
          name: input.name,
          sku: input.sku,
          barcode: input.barcode,
          categoryId: input.categoryId,
          costCents: input.costCents,
          priceCents: input.priceCents,
          minStock: input.minStock,
          stock: input.initialStock,
        },
        include: { category: { select: { id: true, name: true } } },
      })
      if (input.initialStock > 0) {
        await tx.stockMovement.create({
          data: {
            businessId: user.businessId,
            productId: created.id,
            userId: user.id,
            type: 'INITIAL',
            quantity: input.initialStock,
            stockAfter: input.initialStock,
          },
        })
      }
      return created
    })
    return toProductDto(product, true)
  }

  async update(user: RequestUser, id: string, input: UpdateProductInput): Promise<ProductDto> {
    const current = await this.prisma.product.findFirst({ where: { id, businessId: user.businessId } })
    if (!current) throw AppError.notFound('El producto')
    await this.assertUnique(user.businessId, { sku: input.sku, barcode: input.barcode }, id)
    await this.assertCategory(user.businessId, input.categoryId)

    const product = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: input,
        include: { category: { select: { id: true, name: true } } },
      })
      if (updated.priceCents !== current.priceCents || updated.costCents !== current.costCents) {
        await tx.priceChange.create({
          data: {
            businessId: user.businessId,
            productId: id,
            userId: user.id,
            reason: 'MANUAL',
            oldPriceCents: current.priceCents,
            newPriceCents: updated.priceCents,
            oldCostCents: current.costCents,
            newCostCents: updated.costCents,
          },
        })
      }
      return updated
    })
    return toProductDto(product, true)
  }

  private async assertUnique(
    businessId: string,
    { sku, barcode }: { sku?: string; barcode?: string | null },
    exceptId?: string,
  ): Promise<void> {
    const not = exceptId ? { not: exceptId } : undefined
    if (sku && (await this.prisma.product.findFirst({ where: { businessId, sku, id: not }, select: { id: true } }))) {
      throw AppError.conflict('SKU_TAKEN', `Ya existe un producto con el código ${sku}`)
    }
    if (barcode && (await this.prisma.product.findFirst({ where: { businessId, barcode, id: not }, select: { id: true } }))) {
      throw AppError.conflict('BARCODE_TAKEN', 'Ya existe un producto con ese código de barras')
    }
  }

  private async assertCategory(businessId: string, categoryId: string | null | undefined): Promise<void> {
    if (!categoryId) return
    const exists = await this.prisma.category.findFirst({ where: { id: categoryId, businessId }, select: { id: true } })
    if (!exists) throw AppError.notFound('La categoría')
  }
}
