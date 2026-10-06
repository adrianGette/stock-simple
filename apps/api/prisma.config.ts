import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Opcional a propósito: `prisma generate` no se conecta a ninguna base y tiene que
    // funcionar al construir la imagen de Docker, donde no hay .env (los secretos no se
    // copian a las imágenes). Migraciones y seed fallan con un error claro si falta.
    url: process.env.DATABASE_URL ?? '',
  },
})
