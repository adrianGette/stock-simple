import { Injectable } from '@nestjs/common'
import type { CategoryDto, CategoryInput } from '@stock/shared'
import { AppError } from '../common/app-error'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(businessId: string): Promise<CategoryDto[]> {
    const categories = await this.prisma.category.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: { where: { active: true } } } } },
    })
    return categories.map((c) => ({ id: c.id, name: c.name, productCount: c._count.products }))
  }

  async create(businessId: string, { name }: CategoryInput): Promise<CategoryDto> {
    await this.assertNameFree(businessId, name)
    const category = await this.prisma.category.create({ data: { businessId, name } })
    return { id: category.id, name: category.name, productCount: 0 }
  }

  async rename(businessId: string, id: string, { name }: CategoryInput): Promise<CategoryDto> {
    await this.findOrFail(businessId, id)
    await this.assertNameFree(businessId, name, id)
    await this.prisma.category.update({ where: { id }, data: { name } })
    return (await this.list(businessId)).find((c) => c.id === id)!
  }

  async remove(businessId: string, id: string): Promise<void> {
    await this.findOrFail(businessId, id)
    const products = await this.prisma.product.count({ where: { categoryId: id } })
    if (products > 0) {
      throw AppError.conflict('CATEGORY_NOT_EMPTY', `La categoría tiene ${products} producto(s). Movelos antes de eliminarla.`)
    }
    await this.prisma.category.delete({ where: { id } })
  }

  private async findOrFail(businessId: string, id: string) {
    const category = await this.prisma.category.findFirst({ where: { id, businessId } })
    if (!category) throw AppError.notFound('La categoría')
    return category
  }

  private async assertNameFree(businessId: string, name: string, exceptId?: string): Promise<void> {
    const exists = await this.prisma.category.findFirst({
      where: { businessId, name: { equals: name, mode: 'insensitive' }, id: exceptId ? { not: exceptId } : undefined },
    })
    if (exists) throw AppError.conflict('CATEGORY_NAME_TAKEN', 'Ya existe una categoría con ese nombre')
  }
}
