import { Injectable, type OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'
import type { Env } from '../config/env'
import { PrismaClient } from '../generated/prisma/client'

/**
 * La foto de perfil (bytes) se omite en todas las consultas: si no, cada listado de usuarios, cada
 * login y cada venta con su vendedor traerían imágenes que nadie pidió. Para leerla hay que pedirla
 * explícitamente con `omit: { photo: false }`.
 */
const OMIT = { user: { photo: true } } as const

@Injectable()
export class PrismaService extends PrismaClient<{ adapter: PrismaPg; omit: typeof OMIT }> implements OnModuleDestroy {
  constructor(config: ConfigService<Env, true>) {
    super({ adapter: new PrismaPg({ connectionString: config.get('DATABASE_URL', { infer: true }) }), omit: OMIT })
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
