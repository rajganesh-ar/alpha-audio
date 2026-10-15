import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Unit tests for the app's pure modules (src/lib). The catalogue and sign-in services are
// integration tested with the shared Payload config in apps/web/tests/integration.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: { include: ['src/**/*.test.ts'] },
})
