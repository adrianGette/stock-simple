// Los tests e2e usan una base separada para no tocar los datos de desarrollo.
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://stock:stock@localhost:5433/stock_simple_test'
process.env.JWT_ACCESS_SECRET = 'test-secret-test-secret-test-secret-123'
process.env.WEB_ORIGIN = 'http://localhost:5173'
// Cada archivo arranca sin modo demo; demo-mode.e2e-spec.ts lo activa solo para sí.
process.env.DEMO_MODE = 'false'
