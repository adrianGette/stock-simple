import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

// SWC emite la metadata de decoradores que necesita la inyección de dependencias de Nest
// (esbuild, el transformador por defecto de Vitest, no la genera).
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['src/**/*.spec.ts'], environment: 'node' },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          include: ['test/**/*.e2e-spec.ts'],
          environment: 'node',
          globalSetup: ['test/global-setup.ts'],
          setupFiles: ['test/setup-env.ts'],
          // Todas las suites comparten la base de test: se ejecutan de a una.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
})
