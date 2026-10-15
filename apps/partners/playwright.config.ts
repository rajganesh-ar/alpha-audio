import { defineConfig, devices } from '@playwright/test'

/**
 * Dealer board end-to-end tests against a running app on a seeded database (docs/tasks/0014):
 *
 *   pnpm --filter @alpha/web migrate && … seed:catalog && seed:trade   (once per database)
 *   pnpm --filter @alpha/partners build && pnpm --filter @alpha/partners test:e2e
 *
 * Starts `next start` (port 3001) unless E2E_PARTNERS_URL points at a running app. JavaScript
 * is off: the board's forms and disclosures work without it.
 */
const baseURL = process.env['E2E_PARTNERS_URL'] ?? 'http://localhost:3001'

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
  ...(process.env['E2E_PARTNERS_URL']
    ? {}
    : {
        webServer: {
          command: 'pnpm start',
          url: `${baseURL}/login`,
          reuseExistingServer: !process.env['CI'],
          timeout: 120_000,
        },
      }),
})
