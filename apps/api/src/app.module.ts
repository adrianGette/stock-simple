import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { AuthModule } from './auth/auth.module'
import { CategoriesModule } from './categories/categories.module'
import { HttpExceptionFilter } from './common/http-exception.filter'
import { validateEnv } from './config/env'
import { HealthController } from './health/health.controller'
import { PricingModule } from './pricing/pricing.module'
import { PrismaModule } from './prisma/prisma.module'
import { ProductsModule } from './products/products.module'
import { ReportsModule } from './reports/reports.module'
import { SalesModule } from './sales/sales.module'
import { StockModule } from './stock/stock.module'
import { UsersModule } from './users/users.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
      // Los tests e2e hacen muchos logins seguidos desde la misma IP.
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    ProductsModule,
    StockModule,
    SalesModule,
    PricingModule,
    ReportsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Se registra antes que los guards de AuthModule: el rate limit corre primero.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
