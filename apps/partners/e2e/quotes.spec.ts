import { expect, test, type Page } from '@playwright/test'

/** Dealer quotes (docs/tasks/0016) on the seed:trade companies, JavaScript off. */
const PASSWORD = 'partners-demo-123'
const OWNER = 'owner@harmony.example'
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

async function saveQuote(page: Page, reference: string) {
  await page.goto(`/orders/new?sku=${SKU}&qty=1`)
  await page.getByLabel('Your reference (project or customer)').fill(reference)
  await page.getByRole('button', { name: 'Save as quote' }).click()
  await expect(page).toHaveURL(/\/quotes\/Q-AE-\d{4}-\d{6}\?saved=1$/)
}

test('a dealer saves a quote with held stock, then orders it at the quoted price', async ({
  page,
}) => {
  await signIn(page, OWNER)
  await saveQuote(page, 'Villa 12 — E2E')
  await expect(page.getByText('Open', { exact: true })).toBeVisible()
  await expect(page.getByText('Stock held')).toBeVisible()
  await expect(page.getByText(/Prices and FX were locked on/)).toBeVisible()
  const quoteUrl = page.url().replace(/\?.*$/, '')
  const price = await page
    .getByRole('row')
    .filter({ hasText: SKU })
    .getByRole('cell')
    .nth(1)
    .textContent()

  await page.getByRole('button', { name: 'Order this quote' }).click()
  await expect(page).toHaveURL(/\/orders\/T-AE-\d{4}-\d{6}\?placed=1$/)
  await expect(page.getByText('Confirmed', { exact: true })).toBeVisible()
  await expect(page.getByText('Villa 12 — E2E')).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: SKU }).getByRole('cell').nth(1)).toHaveText(
    price ?? '',
  )

  await page.goto(quoteUrl)
  await expect(page.getByText('Ordered', { exact: true })).toBeVisible()
  await expect(page.getByText(/This quote became order T-AE-/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Order this quote' })).toHaveCount(0)
})

test('a dealer withdraws a quote', async ({ page }) => {
  await signIn(page, OWNER)
  const reference = `Withdraw me ${Date.now()}`
  await saveQuote(page, reference)
  await page.getByRole('button', { name: 'Withdraw quote' }).click()
  await expect(page.getByRole('status')).toHaveText(
    'The quote was withdrawn and its stock released.',
  )
  await expect(page.getByText('Withdrawn', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'All quotes' }).click()
  await expect(page.getByRole('row').filter({ hasText: reference })).toContainText('Withdrawn')
})

test('order rules do not stop a quote, but they stop ordering it', async ({ page }) => {
  await signIn(page, GULF)
  await saveQuote(page, 'Rules check')
  await page.getByRole('button', { name: 'Order this quote' }).click()
  await expect(page).toHaveURL(/result=order-refused&refusal=rules$/)
  await expect(page.getByRole('alert')).toContainText('The order could not be placed')
  await expect(page.getByText('Open', { exact: true })).toBeVisible()
})
