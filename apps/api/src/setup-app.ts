import type { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { PRODUCT_IMPORT_MAX_BYTES } from '@stock/shared'
import type { Env } from './config/env'

/** Configuración compartida entre main.ts y los tests e2e, para probar exactamente lo que corre en producción. */
export function setupApp(app: INestApplication): void {
  const config = app.get(ConfigService<Env, true>)
  const express = app as NestExpressApplication

  // Detrás de los proxies del hosting: así el rate limit ve la IP real del cliente.
  express.set('trust proxy', config.get('TRUST_PROXY_HOPS', { infer: true }))
  app.use(helmet())
  app.use(cookieParser())
  // Los CSV de importación llegan como bytes crudos: la API decide la codificación (UTF-8 o la de Excel
  // en Windows). Solo aplica a pedidos con Content-Type text/csv; el resto sigue siendo JSON.
  express.useBodyParser('raw', { type: 'text/csv', limit: PRODUCT_IMPORT_MAX_BYTES })
  app.enableCors({ origin: config.get('WEB_ORIGIN', { infer: true }), credentials: true })
  app.setGlobalPrefix('api')
  app.enableShutdownHooks()

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Stock Simple API')
      .setDescription('Inventario y ventas para comercios chicos. Dinero expresado en centavos.')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build(),
  )
  SwaggerModule.setup('api/docs', app, document)
}
