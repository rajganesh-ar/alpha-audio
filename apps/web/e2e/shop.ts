import { expect, type Page } from '@playwright/test'
import type { Translate } from '@alpha/ui'

/** Storefront steps shared by the e2e suites. Buys the product `seed:e2e` keeps in stock. */
export const PRODUCT = 'sonus-faber-lumina-ii'

export const detailsFor = (page: Page, t: Translate) => ({
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

export async function addToBag(page: Page, locale: 'en' | 'ar', t: Translate) {
  await page.goto(`/ae/${locale}/products/${PRODUCT}/`)
  await page.getByRole('button', { name: t('bag.add') }).click()
  await expect(page).toHaveURL(new RegExp(`/ae/${locale}/bag/\\?status=added$`))
  await expect(page.getByRole('status')).toHaveText(t('bag.added'))
}

export async function emptyBag(page: Page, locale: 'en' | 'ar', t: Translate) {
  await page.goto(`/ae/${locale}/bag/`)
  for (const button of await page
    .getByRole('button', { name: new RegExp(`^${t('bag.remove')}`) })
    .all()) {
    await button.click()
  }
  await page.goto(`/ae/${locale}/bag/`)
  await expect(page.getByText(t('bag.emptyTitle'), { exact: true })).toBeVisible()
}

/** Buys one unit in ae/{locale} and pays on the sandbox page; returns the order page URL. */
export async function buy(
  page: Page,
  locale: 'en' | 'ar',
  t: Translate,
): Promise<{ number: string; orderUrl: string }> {
  await emptyBag(page, locale, t)
  await addToBag(page, locale, t)
  await page.getByRole('link', { name: t('bag.checkout') }).click()
  await detailsFor(page, t).fill()
  await page
    .getByRole('button', { name: new RegExp(t('checkout.pay', { amount: '' }).trim()) })
    .click()
  await page
    .getByRole('button', { name: new RegExp(t('checkout.sandbox.pay', { amount: '' }).trim()) })
    .click()
  await expect(
    page.getByRole('heading', { name: t('checkout.return.confirmedTitle') }),
  ).toBeVisible()
  const number = new URL(page.url()).searchParams.get('order') ?? ''
  await page.getByRole('link', { name: t('orders.view') }).click()
  await expect(page).toHaveURL(new RegExp(`/ae/${locale}/orders/${number}/\\?token=`))
  return { number, orderUrl: page.url() }
}
