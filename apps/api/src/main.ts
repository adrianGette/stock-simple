import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import type { Env } from './config/env'
import { setupApp } from './setup-app'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  setupApp(app)
  const port = app.get(ConfigService<Env, true>).get('PORT', { infer: true })
  await app.listen(port)
  Logger.log(`API lista en http://localhost:${port}/api · Docs en /api/docs`, 'Bootstrap')
}

void bootstrap()
