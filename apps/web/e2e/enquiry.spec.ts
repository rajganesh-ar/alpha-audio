import { expect, test } from '@playwright/test'
import { copy } from './copy'
import { PRODUCT } from './shop'

/**
 * Storefront enquiries (docs/tasks/0018), JavaScript off: from the product page to the
 * thank-you notice, in English and Arabic. Routing to a dealer runs in the background job.
 */
for (const locale of ['en', 'ar'] as const) {
  test(`a shopper asks a specialist about a product (${locale})`, async ({ page }) => {
    const t = copy(locale)
    await page.goto(`/ae/${locale}/products/${PRODUCT}/`)
    await page.getByRole('link', { name: t('enquiry.specialist') }).click()
    await expect(page).toHaveURL(new RegExp(`/ae/${locale}/enquire/\\?product=${PRODUCT}$`))
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
    await page.getByLabel(new RegExp(`^${t('enquiry.name')}`)).fill('Mariam')
    await page
      .getByLabel(new RegExp(`^${t('enquiry.email')}`))
      .fill(`mariam-${locale}-${Date.now()}@example.com`)
    await page.getByLabel(t('enquiry.city')).fill('Dubai')
    await page.getByLabel(t('enquiry.message')).fill('Speakers for a 20 m² majlis.')
    await page.getByLabel(t('enquiry.consent')).check()
    await page.getByRole('button', { name: t('enquiry.send') }).click()
    await expect(page).toHaveURL(
      new RegExp(`/ae/${locale}/enquire/\\?product=${PRODUCT}&status=sent$`),
    )
    await expect(page.getByRole('status')).toHaveText(t('enquiry.status.sent'))
    await expect(page.getByRole('button', { name: t('enquiry.send') })).toHaveCount(0)
  })
}
