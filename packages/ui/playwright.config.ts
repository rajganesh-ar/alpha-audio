import { defineConfig, devices } from '@playwright/test'

/**
 * Runs against the static Storybook build (`pnpm build-storybook`):
 *  - `a11y`: axe on every story, LTR and RTL, zero violations allowed.
 *  - `visual`: one screenshot per story and direction, compared with the committed baselines.
 *
 * @playwright/test is pinned to 1.56.1 because it drives Chromium build 1194, the build
 * preinstalled in the cloud workspace; CI downloads the same build, so baselines match.
 */
const PORT = 6106

export default defineConfig({
  testDir: 'tests/stories',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  expect: {
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css', maxDiffPixelRatio: 0 },
  },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 1,
    contextOptions: { reducedMotion: 'reduce' },
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'Asia/Dubai',
  },
  projects: [
    { name: 'a11y', testMatch: 'a11y.spec.ts' },
    { name: 'visual', testMatch: 'visual.spec.ts' },
  ],
  webServer: {
    command: `node scripts/serve-static.mjs storybook-static ${PORT}`,
    url: `http://127.0.0.1:${PORT}/index.json`,
    reuseExistingServer: !process.env['CI'],
  },
})
