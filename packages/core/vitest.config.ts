import { defineConfig } from 'vitest/config'

// Pure package: CLAUDE.md requires 90 % line coverage, enforced here so `pnpm test` (and CI) fail below it.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      reporter: ['text-summary'],
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 85 },
    },
  },
})
