import { Module } from '@nestjs/common'
import { ProductImportService } from './product-import.service'
import { ProductsController } from './products.controller'
import { ProductsService } from './products.service'

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, ProductImportService],
})
export class ProductsModule {}
