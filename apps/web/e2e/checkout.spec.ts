import { expect, test, type Page } from '@playwright/test'
import type { Translate } from '@alpha/ui'
import { copy } from './copy'

/**
 * Bag → checkout → sandbox payment → confirmation, in ae/en and ae/ar, with JavaScript off
 * (docs/tasks/0009). Buys the product `seed:e2e` keeps in stock.
 */
const PRODUCT = 'sonus-faber-lumina-ii'

const detailsFor = (page: Page, t: Translate) => ({
  async fill() {
    await page.getByLabel(t('checkout.name')).fill('Layla Haddad')
    await page.getByLabel(t('checkout.email')).fill('layla@example.com')
    await page.getByLabel(t('checkout.phone')).fill('+971 50 123 4567')
    await page.getByLabel(t('checkout.address.city')).fill('Dubai')
    await page.getByLabel(t('checkout.address.area')).fill('Al Quoz')
    await page.getByLabel(t('checkout.address.street')).fill('Street 6A')
    await page.getByLabel(t('checkout.address.building')).fill('Warehouse 12')
  },
})

async function addToBag(page: Page, locale: 'en' | 'ar', t: Translate) {
  await page.goto(`/ae/${locale}/products/${PRODUCT}/`)
  await page.getByRole('button', { name: t('bag.add') }).click()
  await expect(page).toHaveURL(new RegExp(`/ae/${locale}/bag/\\?status=added$`))
  await expect(page.getByRole('status')).toHaveText(t('bag.added'))
}

async function emptyBag(page: Page, locale: 'en' | 'ar', t: Translate) {
  await page.goto(`/ae/${locale}/bag/`)
  for (const button of await page
    .getByRole('button', { name: new RegExp(`^${t('bag.remove')}`) })
    .all()) {
    await button.click()
  }
  await page.goto(`/ae/${locale}/bag/`)
  await expect(page.getByText(t('bag.emptyTitle'), { exact: true })).toBeVisible()
}

for (const locale of ['en', 'ar'] as const) {
  const t = copy(locale)

  test.describe(`checkout in ae/${locale}`, () => {
    test('add, change quantity, remove and pay', async ({ page }) => {
      await emptyBag(page, locale, t)
      await addToBag(page, locale, t)
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')

      // Quantity 2: the line total doubles and the VAT share follows (5% inclusive).
      const line = page.getByRole('article')
      const unit = await line.locator('p.tabular-nums').last().innerText()
      await line.getByLabel(t('bag.quantity')).selectOption('2')
      await line.getByRole('button', { name: t('bag.update') }).click()
      await expect(page.getByRole('article').locator('p.tabular-nums').last()).not.toHaveText(unit)

      // Remove, then add one again.
      await page.getByRole('button', { name: new RegExp(`^${t('bag.remove')}`) }).click()
      await expect(page.getByText(t('bag.emptyTitle'), { exact: true })).toBeVisible()
      await addToBag(page, locale, t)

      await page.getByRole('link', { name: t('bag.checkout') }).click()
      await expect(page).toHaveURL(new RegExp(`/ae/${locale}/checkout/$`))
      await detailsFor(page, t).fill()
      await expect(page.getByRole('radio', { name: t('checkout.methods.card') })).toBeChecked()
      await page
        .getByRole('button', { name: new RegExp(t('checkout.pay', { amount: '' }).trim()) })
        .click()

      // The sandbox plays the gateway: Pay sends a signed capture to the webhook.
      await expect(page).toHaveURL(/\/checkout\/sandbox\/sbx_/)
      await expect(page.getByRole('heading', { name: t('checkout.sandbox.title') })).toBeVisible()
      await page
        .getByRole('button', { name: new RegExp(t('checkout.sandbox.pay', { amount: '' }).trim()) })
        .click()

      await expect(page).toHaveURL(/\/checkout\/return\/\?order=AE-\d{4}-\d{6}&token=/)
      await expect(
        page.getByRole('heading', { name: t('checkout.return.confirmedTitle') }),
      ).toBeVisible()
      await expect(page.getByText(/AE-\d{4}-\d{6}/).first()).toBeVisible()

      // The bag closed with the order.
      await page.goto(`/ae/${locale}/bag/`)
      await expect(page.getByText(t('bag.emptyTitle'), { exact: true })).toBeVisible()
    })
  })
}

test('a declined payment keeps the bag and says nothing was charged', async ({ page }) => {
  const t = copy('en')
  await emptyBag(page, 'en', t)
  await addToBag(page, 'en', t)
  await page.getByRole('link', { name: t('bag.checkout') }).click()
  await detailsFor(page, t).fill()
  await page.getByRole('button', { name: /^Pay / }).click()
  await page.getByRole('button', { name: t('checkout.sandbox.decline') }).click()
  await expect(
    page.getByRole('heading', { name: t('checkout.return.failedTitle') }).first(),
  ).toBeVisible()
  await page.getByRole('link', { name: t('checkout.return.toBag') }).click()
  await expect(page.getByRole('article')).toHaveCount(1)
  await emptyBag(page, 'en', t)
})

test('missing details return to the form with the fields marked', async ({ page }) => {
  const t = copy('en')
  await emptyBag(page, 'en', t)
  await addToBag(page, 'en', t)
  await page.goto('/ae/en/checkout/')
  await detailsFor(page, t).fill()
  // Browser validation would stop an empty field; a malformed phone reaches the server.
  await page.getByLabel(t('checkout.phone')).fill('12')
  await page.getByRole('button', { name: /^Pay / }).click()
  await expect(page).toHaveURL(/\/checkout\/\?status=invalid$/)
  await expect(page.getByRole('alert').first()).toHaveText(t('checkout.errorsTitle'))
  await expect(page.getByLabel(t('checkout.phone'))).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByLabel(t('checkout.name'))).toHaveValue('Layla Haddad')
  await emptyBag(page, 'en', t)
})
