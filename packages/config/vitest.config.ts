import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { include: ['eslint-plugin-alpha/tests/**/*.test.js'] } })
