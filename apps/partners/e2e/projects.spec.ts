import { expect, test, type Page } from '@playwright/test'

/**
 * Project registrations (docs/tasks/0017) on the seed:trade companies, JavaScript off. seed:trade
 * approves a demo project for Harmony ("Palm villa cinema": Lumina II at AED 4,500.00 net).
 */
const PASSWORD = 'partners-demo-123'
const OWNER = 'owner@harmony.example'
const GULF = 'owner@gulf-integrators.example'
const SKU = 'SONUSFABER-LUMINA-II'
const money = (text: string) =>
  new RegExp(text.replace(/[.+]/g, '\\$&').replace(/ /g, '[\\s\\u00a0]'))
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

async function signIn(page: Page, email: string) {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/catalogue$/)
}

async function demoProject(page: Page) {
  await page.goto('/projects')
  await page
    .getByRole('row')
    .filter({ hasText: 'Palm villa cinema' })
    .filter({ hasText: 'Approved' })
    .getByRole('link')
    .first()
    .click()
  await expect(page.getByText('Approved', { exact: true })).toBeVisible()
  return page.url().match(/P-AE-\d{4}-\d{6}/)?.[0] ?? ''
}

test('a dealer registers a project for Alpha to review', async ({ page }) => {
  await signIn(page, OWNER)
  await page.goto('/projects')
  await page.getByRole('link', { name: 'Register a project' }).click()
  const name = `Marina office ${Date.now()}`
  await page.getByLabel(/^Project name/).fill(name)
  await page.getByLabel(/^End customer/).fill('Marina Holdings')
  await page.getByLabel('City').fill('Dubai')
  await page.getByLabel(/^Expected close/).fill(inDays(30))
  await page.getByLabel('SKU').first().fill(SKU)
  await page.getByLabel('Quantity').first().fill('4')
  await page.getByRole('button', { name: 'Register project' }).click()
  await expect(page).toHaveURL(/\/projects\/P-AE-\d{4}-\d{6}\?result=registered$/)
  await expect(page.getByRole('status')).toHaveText(
    'Your project was registered. Alpha will review it.',
  )
  await expect(page.getByText('Waiting for Alpha', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toContainText(name)
  await expect(page.getByRole('link', { name: 'Order for this project' })).toHaveCount(0)
})

test('problems come back on the form with what was typed', async ({ page }) => {
  await signIn(page, OWNER)
  await page.goto('/projects/new')
  await page.getByLabel(/^Project name/).fill('Typo check')
  await page.getByLabel(/^End customer/).fill('Someone')
  await page.getByLabel(/^Expected close/).fill('2020-01-01')
  await page.getByLabel('SKU').first().fill('NOT-A-PRODUCT')
  await page.getByLabel('Quantity').first().fill('1')
  await page.getByRole('button', { name: 'Register project' }).click()
  await expect(page).toHaveURL(/\/projects\/new\?result=invalid/)
  await expect(page.getByText('Enter a date that is not in the past.')).toBeVisible()
  await expect(page.getByText('One or more SKUs are not in the catalogue.')).toBeVisible()
  await expect(page.getByLabel(/^Project name/)).toHaveValue('Typo check')
  await expect(page.getByLabel('SKU').first()).toHaveValue('NOT-A-PRODUCT')
})

test('ordering for an approved project uses the project price', async ({ page }) => {
  await signIn(page, OWNER)
  await demoProject(page)
  await expect(page.getByRole('row').filter({ hasText: SKU })).toContainText(money('AED 4,500.00'))
  await page.getByRole('link', { name: 'Order for this project' }).click()
  await expect(
    page.getByText(/Priced for project P-AE-\d{4}-\d{6}: Palm villa cinema/),
  ).toBeVisible()
  const line = page.getByRole('row').filter({ hasText: SKU })
  await expect(line).toContainText(money('AED 4,500.00'))
  await line.getByText('Why this price').click()
  await expect(line.getByRole('listitem').filter({ hasText: 'Project price' })).toContainText(
    money('AED 4,500.00'),
  )
  // Order one unit only.
  await page.getByLabel('Quantity').first().fill('1')
  await page.getByRole('button', { name: 'Review order' }).click()
  await page.getByRole('button', { name: /Place order|Send for approval/ }).click()
  await expect(page).toHaveURL(/\/orders\/T-AE-\d{4}-\d{6}\?placed=1$/)
  await expect(page.getByRole('row').filter({ hasText: SKU })).toContainText(money('AED 4,500.00'))
})

test('another company cannot price with the project', async ({ page }) => {
  await signIn(page, OWNER)
  const number = await demoProject(page)
  await signIn(page, GULF)
  await page.goto(`/orders/new?project=${number}&sku=${SKU}&qty=2`)
  await expect(
    page.getByRole('alert').filter({ hasText: 'That project cannot be used' }),
  ).toBeVisible()
  await expect(page.getByText(/Priced for project/)).toHaveCount(0)
  await expect(page.getByRole('row').filter({ hasText: SKU })).not.toContainText(
    money('AED 4,500.00'),
  )
})
