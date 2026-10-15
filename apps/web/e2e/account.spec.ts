import { expect, test } from '@playwright/test'
import { copy } from './copy'
import { latestEmailTo } from './mail'
import { buy } from './shop'

/**
 * My Alpha (docs/tasks/0012), JavaScript off: buy with an address, ask for a sign-in link, open
 * it from the email (Mailpit), sign in, see the order, sign out.
 */
for (const locale of ['en', 'ar'] as const) {
  test(`sign in by email link and see my orders in ae/${locale}`, async ({ page, request }) => {
    const t = copy(locale)
    const email = `e2e-${locale}-${Date.now()}@example.com`
    const { number } = await buy(page, locale, t, email)

    await page.goto(`/ae/${locale}/`)
    await page
      .getByRole('link', { name: t('ui.account') })
      .first()
      .click()
    await expect(page).toHaveURL(new RegExp(`/ae/${locale}/account/$`))
    await page.getByLabel(t('account.email')).fill(email)
    await page.getByRole('button', { name: t('account.send') }).click()
    await expect(page.getByRole('status')).toHaveText(t('account.status.sent'))

    const mail = await latestEmailTo(request, email)
    const link = /(https?:\/\/\S+\/account\/verify\/\?token=[\w-]+)/.exec(mail.text)?.[1] ?? ''
    expect(link).not.toBe('')
    // Opening the link does not sign in by itself (mail scanners open links too).
    await page.goto(new URL(link).pathname + new URL(link).search)
    await expect(page.getByRole('heading', { name: t('account.verifyTitle') })).toBeVisible()
    await page.getByRole('button', { name: t('account.verify') }).click()

    await expect(page).toHaveURL(new RegExp(`/ae/${locale}/account/orders/$`))
    await expect(page.getByText(email)).toBeVisible()
    await page.getByRole('link', { name: t('account.viewOrder', { number }) }).click()
    await expect(page.getByRole('heading', { name: t('orders.title', { number }) })).toBeVisible()
    await expect(page.getByRole('list', { name: t('orders.progress') })).toBeVisible()

    // The link works once.
    await page.goto(new URL(link).pathname + new URL(link).search)
    await page.getByRole('button', { name: t('account.verify') }).click()
    await expect(page.getByRole('alert')).toHaveText(t('account.status.used'))

    await page.goto(`/ae/${locale}/account/orders/`)
    await page.getByRole('button', { name: t('account.signOut') }).click()
    await expect(page.getByRole('status')).toHaveText(t('account.status.signed-out'))
    await page.goto(`/ae/${locale}/account/orders/`)
    await expect(page).toHaveURL(new RegExp(`/ae/${locale}/account/$`))
  })
}
