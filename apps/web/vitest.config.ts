import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Integration tests live in tests/integration, never in src/migrations: `payload migrate`
// imports every file in that folder as a migration.
export default defineConfig({
  // Same aliases as tsconfig.json, so app modules (src/lib) load under Vitest.
  resolve: {
    alias: {
      '@payload-config': path.resolve(import.meta.dirname, 'src/payload.config.ts'),
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.integration.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          testTimeout: 180_000,
          hookTimeout: 180_000,
        },
      },
    ],
  },
})
