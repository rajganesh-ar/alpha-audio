import { defineConfig, devices } from '@playwright/test'

/**
 * Storefront end-to-end tests against a running, seeded app (CLAUDE.md → Testing):
 *
 *   pnpm --filter @alpha/web seed:markets && … seed:catalog && seed:e2e   (once per database)
 *   pnpm --filter @alpha/web build && pnpm --filter @alpha/web test:e2e
 *
 * Starts `next start` unless E2E_BASE_URL points at an app that is already running. Runs with
 * JavaScript disabled: every storefront form must work without it (docs/tasks/0009).
 * @playwright/test is pinned to the version packages/ui uses (Chromium build 1194).
 */
const baseURL = process.env['E2E_BASE_URL'] ?? 'http://localhost:3000'

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  timeout: 60_000,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    javaScriptEnabled: false,
    locale: 'en-US',
    timezoneId: 'Asia/Dubai',
    trace: 'retain-on-failure',
  },
  ...(process.env['E2E_BASE_URL']
    ? {}
    : {
        webServer: {
          command: 'pnpm start',
          url: `${baseURL}/ae/en/`,
          reuseExistingServer: !process.env['CI'],
          timeout: 120_000,
        },
      }),
})
