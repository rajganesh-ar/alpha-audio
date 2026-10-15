import { expect, test, type Page } from '@playwright/test'

/**
 * Dealer orders (docs/tasks/0015) on the seed:trade companies, JavaScript off. seed:e2e keeps
 * SONUSFABER-LUMINA-II in stock so the suite can run again and again.
 */
const PASSWORD = 'partners-demo-123'
const OWNER = 'owner@harmony.example'
const BUYER = 'buyer@harmony.example'
const VIEWER = 'viewer@harmony.example'
const GULF = 'owner@gulf-integrators.example'
const SKU = 'SONUSFABER-LUMINA-II'

async function signIn(page: Page, email: string) {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/catalogue$/)
}

/** From the catalogue's order link to the review, with a PO reference, then place it. */
async function orderFromCatalogue(page: Page, po: string) {
  await page
    .getByRole('row')
    .filter({ hasText: SKU })
    .getByRole('link', { name: /^Order\b/ })
    .click()
  await expect(page).toHaveURL(/\/orders\/new\?sku=SONUSFABER-LUMINA-II&qty=1$/)
  await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible()
  await page.getByLabel('Your PO reference').fill(po)
}

test('an owner orders within credit and the order is confirmed at once', async ({ page }) => {
  await signIn(page, OWNER)
  await orderFromCatalogue(page, 'E2E-OWNER')
  await expect(page.getByText('This order is confirmed as soon as you place it.')).toBeVisible()
  await expect(page.getByRole('meter', { name: 'Credit' })).toBeVisible()
  await page.getByRole('button', { name: 'Place order' }).click()
  await expect(page).toHaveURL(/\/orders\/T-AE-\d{4}-\d{6}\?placed=1$/)
  await expect(page.getByText('Confirmed', { exact: true })).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: SKU })).toBeVisible()
  const number = page.url().match(/T-AE-\d{4}-\d{6}/)?.[0] ?? ''
  await page.getByRole('link', { name: 'All orders' }).click()
  await expect(page.getByRole('row').filter({ hasText: number })).toContainText('E2E-OWNER')
})

test('a purchaser’s order waits for the owner, who approves it', async ({ page }) => {
  await signIn(page, BUYER)
  await orderFromCatalogue(page, 'E2E-BUYER')
  await expect(page.getByText('This order will wait for approval:')).toBeVisible()
  await expect(
    page.getByText(/Your company’s owner: above the purchaser’s approval limit/),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Send for approval' }).click()
  await expect(page.getByText('Waiting for approval', { exact: true })).toBeVisible()
  await expect(page.getByText(/Stock is held until/)).toBeVisible()
  // The purchaser may withdraw it but not approve it.
  await expect(page.getByRole('button', { name: 'Cancel order' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0)
  const url = page.url().replace(/\?.*$/, '')

  await signIn(page, OWNER)
  await page.goto(url)
  await page.getByLabel('Reason (optional)').fill('OK for the showroom')
  await page.getByRole('button', { name: 'Approve' }).click()
  await expect(page).toHaveURL(/\?decision=approved$/)
  await expect(page.getByRole('status')).toHaveText('Your approval was recorded.')
  await expect(page.getByText('Confirmed', { exact: true })).toBeVisible()
  await expect(page.getByText(/OK for the showroom/)).toBeVisible()
})

test('a purchaser cancels a pending order and its stock is released', async ({ page }) => {
  await signIn(page, BUYER)
  await orderFromCatalogue(page, 'E2E-CANCEL')
  await page.getByRole('button', { name: 'Send for approval' }).click()
  await page.getByRole('button', { name: 'Cancel order' }).click()
  await expect(page.getByRole('status')).toHaveText(
    'The order was cancelled and its stock released.',
  )
  await expect(page.getByText('Cancelled', { exact: true })).toBeVisible()
})

test('order rules are explained inline and nothing is placed', async ({ page }) => {
  await signIn(page, GULF)
  await page.goto(`/orders/new?sku=${SKU}&qty=1&sku=NOT-A-PRODUCT&qty=2`)
  const alert = page.getByRole('alert').filter({ hasText: 'Fix the problems below' })
  await expect(alert).toContainText(/Your minimum order is AED[\s\u00a0]10,000\.00 before VAT\./)
  await expect(page.getByText('Order in multiples of 2.').first()).toBeVisible()
  await expect(page.getByText('Not available to your company.').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Place order|Send for approval/ })).toHaveCount(0)
})

test('a viewer browses but cannot order', async ({ page, baseURL }) => {
  await signIn(page, VIEWER)
  await expect(page.getByRole('table').getByRole('link')).toHaveCount(0)
  await page.goto(`/orders/new?sku=${SKU}&qty=1`)
  await expect(page.getByRole('alert').first()).toHaveText(/can browse the catalogue but not order/)
  await expect(page.getByRole('button', { name: 'Place order' })).toHaveCount(0)
  // Posting anyway is refused by the service.
  const res = await page.request.post('/api/v1/orders', {
    data: { lines: [{ sku: SKU, qty: 1 }], idempotencyKey: `viewer-${Date.now()}` },
    headers: { origin: baseURL ?? '' },
  })
  expect(res.status()).toBe(403)
  expect((await res.json()).error.code).toBe('not-allowed')
})

test('the orders API is idempotent on the key and scoped to the company', async ({
  page,
  baseURL,
}) => {
  await signIn(page, OWNER)
  const key = `e2e-${Date.now()}`
  const body = { lines: [{ sku: SKU, qty: 1 }], idempotencyKey: key, poNumber: 'E2E-API' }
  const headers = { origin: baseURL ?? '' }
  const first = await page.request.post('/api/v1/orders', { data: body, headers })
  const second = await page.request.post('/api/v1/orders', { data: body, headers })
  expect([first.status(), second.status()]).toEqual([201, 200])
  const a = (await first.json()).order.number
  expect((await second.json()).order.number).toBe(a)
  expect(first.headers()['cache-control']).toBe('private, no-store')

  await signIn(page, GULF)
  const list = await (
    await page.request.get('/api/v1/orders', { headers: { 'sec-fetch-site': 'same-origin' } })
  ).json()
  expect(list.docs.map((o: { number: string }) => o.number)).not.toContain(a)
  await page.goto(`/orders/${a}`)
  await expect(page.getByText('Page not found')).toBeVisible()
  await expect(page.getByText('E2E-API')).toHaveCount(0)
})
