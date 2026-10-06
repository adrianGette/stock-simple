import { defineConfig, devices } from '@playwright/test'

/**
 * Tests de punta a punta: levantan una API y una web propias (puertos 3100 / 5174)
 * contra la base `stock_simple_test`, recién migrada y con el seed de demo.
 * Nunca tocan los datos de desarrollo.
 */
const TEST_DB = process.env.TEST_DATABASE_URL ?? 'postgresql://stock:stock@localhost:5433/stock_simple_test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5174',
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: [
    {
      command: 'npx prisma migrate deploy && npx prisma db seed && npx nest start',
      cwd: '../api',
      url: 'http://localhost:3100/api/health',
      env: { DATABASE_URL: TEST_DB, PORT: '3100', NODE_ENV: 'test' },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npx vite --port 5174 --strictPort',
      url: 'http://localhost:5174',
      env: { API_PROXY_TARGET: 'http://localhost:3100' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
