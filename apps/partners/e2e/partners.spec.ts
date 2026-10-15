import { expect, test, type Page } from '@playwright/test'

/**
 * The dealer board (docs/tasks/0014) on the seed:trade companies: Harmony Systems (dealer, gold,
 * contract price on the MA352, exact stock) and Gulf Integrators (integrator, buyer group with a
 * McIntosh discount, banded stock). JavaScript is off.
 */
const PASSWORD = 'partners-demo-123'
const HARMONY = 'owner@harmony.example'
const HARMONY_AR = 'arabic@harmony.example'
const HARMONY_VIEWER = 'viewer@harmony.example'
const GULF = 'owner@gulf-integrators.example'
const MA352 = 'MCINTOSH-MA352'
/** Intl separates the currency from the amount with a no-break space. */
const money = (text: string) =>
  new RegExp(text.replace(/[.+]/g, '\\$&').replace(/ /g, '[\\s\\u00a0]'))

async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto('/login')
  await page.getByLabel(/Email|البريد الإلكتروني/).fill(email)
  await page.getByLabel(/Password|كلمة المرور/).fill(password)
  await page.getByRole('button', { name: /Sign in|تسجيل الدخول/ }).click()
}

const row = (page: Page, sku: string) => page.getByRole('row').filter({ hasText: sku })

test('a dealer signs in and sees its own prices, the RRP, the trace and exact stock', async ({
  page,
}) => {
  await signIn(page, HARMONY)
  await expect(page).toHaveURL(/\/catalogue$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Catalogue' })).toBeVisible()
  const header = page.getByRole('banner')
  await expect(header).toContainText('Harmony Systems LLC')
  await expect(header).toContainText(money('Gold · Credit limit AED 50,000.00'))

  const amp = row(page, MA352)
  await expect(amp).toContainText(money('AED 34,500.00'))
  await expect(amp).toContainText(money('AED 21,000.00'))
  await expect(amp.getByRole('cell').last()).toHaveText(/^\d+$/)
  await amp.getByText('Why this price').click()
  await expect(amp.getByRole('listitem').filter({ hasText: 'Your contract price' })).toContainText(
    money('AED 21,000.00'),
  )
  await expect(row(page, 'MCINTOSH-MA252')).toContainText('Needs approval')
  await expect(page.getByText('Price check')).toHaveCount(0)

  const response = await page.request.get('/catalogue')
  expect(response.headers()['cache-control']).toBe('private, no-store')
  expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow')
})

test('searching narrows the catalogue and clearing restores it', async ({ page }) => {
  await signIn(page, HARMONY)
  await page.getByLabel('Search the catalogue').fill('marantz')
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page).toHaveURL(/q=marantz/)
  const skus = await page.locator('tbody th .font-mono').allTextContents()
  expect(skus.length).toBeGreaterThan(0)
  expect(skus.every((s) => s.startsWith('MARANTZ-'))).toBe(true)
  await page.getByRole('link', { name: 'Clear search' }).click()
  await expect(row(page, MA352)).toBeVisible()
})

test('another company sees its own price for the same product, and banded stock', async ({
  page,
}) => {
  await signIn(page, GULF)
  await expect(page.getByRole('banner')).toContainText('Gulf Integrators FZE')
  const amp = row(page, MA352)
  // 34,500.00 incl. 5 % VAT → 32,857.14 net × 75 % (integrator) − 5 % (group) = 23,410.72
  await expect(amp).toContainText(money('AED 23,410.72'))
  await expect(amp).not.toContainText(money('AED 21,000.00'))
  await expect(amp.getByRole('cell').last()).toHaveText(/^(10\+|3–9|Low|Out of stock|Expected .+)$/)
  // The integrators' price list.
  await expect(row(page, 'MARANTZ-MODEL-40N')).toContainText(money('AED 8,800.00'))
})

test('a viewer sees prices but not the credit line', async ({ page }) => {
  await signIn(page, HARMONY_VIEWER)
  await expect(page.getByRole('banner')).toContainText('Harmony Systems LLC')
  await expect(page.getByRole('banner')).not.toContainText('Credit limit')
  await expect(row(page, MA352)).toContainText(money('AED 21,000.00'))
})

test('wrong details are refused with a reason; staff cannot sign in here', async ({ page }) => {
  await signIn(page, HARMONY, 'not-the-password')
  await expect(page).toHaveURL(/\/login\?status=invalid$/)
  await expect(page.getByRole('alert')).toHaveText(
    'That email and password do not match a dealer account.',
  )
  await signIn(page, 'dev@alpha.local', 'dev-password-123')
  await expect(page).toHaveURL(/\/login\?status=invalid$/)
  await page.goto('/catalogue')
  await expect(page).toHaveURL(/\/login$/)
})

test('signing out ends the session on the server', async ({ page, playwright, baseURL }) => {
  await signIn(page, HARMONY)
  await expect(page).toHaveURL(/\/catalogue$/)
  const cookie = (await page.context().cookies()).find((c) => c.name === 'alpha-partners-token')
  expect(cookie?.httpOnly).toBe(true)
  expect(cookie?.sameSite).toBe('Lax')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login\?status=signed-out$/)
  await expect(page.getByRole('status')).toHaveText('You have signed out.')

  // The old token no longer authenticates, even if a copy was kept.
  const replay = await playwright.request.newContext({
    baseURL: baseURL ?? '',
    extraHTTPHeaders: {
      cookie: `alpha-partners-token=${cookie?.value ?? ''}`,
      'sec-fetch-site': 'same-origin',
    },
  })
  expect((await replay.get('/api/v1/catalogue')).status()).toBe(401)
  await replay.dispose()
})

test('the API needs a company session, and cross-site posts are refused', async ({
  playwright,
  baseURL,
}) => {
  const anonymous = await playwright.request.newContext({ baseURL: baseURL ?? '' })
  expect((await anonymous.get('/api/v1/catalogue')).status()).toBe(401)
  const resolve = await anonymous.post('/api/v1/price/resolve', {
    data: { lines: [{ sku: MA352, qty: 1 }] },
  })
  expect(resolve.status()).toBe(401)
  expect(resolve.headers()['cache-control']).toBe('private, no-store')
  const cross = await anonymous.post('/api/v1/session', {
    form: { email: HARMONY, password: PASSWORD },
    headers: { origin: 'https://evil.example' },
    maxRedirects: 0,
  })
  expect(cross.status()).toBe(303)
  expect(cross.headers()['location']).toBe('/login?status=cross-site')
  expect(cross.headers()['set-cookie']).toBeUndefined()
  const robots = await anonymous.get('/robots.txt')
  expect(await robots.text()).toMatch(/Disallow: \/\s*$/)
  await anonymous.dispose()
})

test('an Arabic-speaking user gets the board in Arabic, right to left', async ({ page }) => {
  await signIn(page, HARMONY_AR)
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  await expect(page.getByRole('heading', { level: 1, name: 'الكتالوج' })).toBeVisible()
  // Western digits in Arabic (CLAUDE.md, UI).
  await expect(row(page, MA352)).toContainText(/21,000\.00/)
  await expect(page.getByRole('banner')).toContainText('حد الائتمان')
})
