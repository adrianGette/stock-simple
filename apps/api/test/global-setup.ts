import { execSync } from 'node:child_process'

/** Aplica las migraciones a la base de test antes de correr la suite. */
export default function globalSetup(): void {
  execSync('npx prisma migrate deploy', {
    stdio: 'ignore',
    env: {
      ...process.env,
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://stock:stock@localhost:5433/stock_simple_test',
    },
  })
}
