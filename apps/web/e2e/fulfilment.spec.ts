import { expect, test } from '@playwright/test'
import { copy } from './copy'
import { buy } from './shop'

/**
 * An order bought in ae/en goes through the ops screens (pick, ship, deliver) while the customer
 * watches their order page (docs/tasks/0010). JavaScript off throughout. Staff sign in through
 * Payload's REST login, which sets the same session cookie the admin uses.
 */
const STAFF = { email: 'dev@alpha.local', password: 'dev-password-123' }

test('staff pick, ship and deliver; the customer sees each step', async ({ page }) => {
  const t = copy('en')
  const { number, orderUrl } = await buy(page, 'en', t)
  const progress = page.getByRole('list', { name: t('orders.progress') })
  await expect(progress.locator('[aria-current="step"]')).toContainText(t('orders.steps.picked'))

  // Ops without a session: asked to sign in.
  await page.goto('/ops/orders/')
  await expect(page.getByRole('link', { name: t('ops.signInAction') })).toBeVisible()
  const login = await page.request.post('/api/users/login', { data: STAFF })
  expect(login.ok()).toBe(true)

  await page.goto('/ops/orders/?queue=awaiting')
  await page.getByRole('link', { name: number }).click()
  await expect(page.getByRole('heading', { name: number })).toBeVisible()
  await page.getByRole('button', { name: t('ops.pick') }).click()
  await expect(page.getByRole('status')).toHaveText(t('ops.results.picked'))

  await page.getByLabel(t('ops.courier')).fill('Aramex')
  await page.getByLabel(t('ops.tracking')).fill('44219988')
  await page.getByLabel(t('ops.trackingUrl')).fill('https://www.aramex.com/track/44219988')
  await page.getByRole('button', { name: t('ops.ship') }).click()
  await expect(page.getByRole('status')).toHaveText(t('ops.results.shipped'))

  await page.goto(orderUrl)
  await expect(progress.locator('[aria-current="step"]')).toContainText(t('orders.steps.shipped'))
  await expect(
    page.getByText(t('orders.shippedWith', { courier: 'Aramex', tracking: '44219988' })),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: t('orders.track') })).toHaveAttribute(
    'href',
    'https://www.aramex.com/track/44219988',
  )

  await page.goto(`/ops/orders/${number}/`)
  await page.getByRole('button', { name: t('ops.deliver') }).click()
  await expect(page.getByRole('status')).toHaveText(t('ops.results.delivered'))

  await page.goto(orderUrl)
  await expect(progress.locator('[aria-current="step"]')).toHaveCount(0)
  await expect(progress.getByRole('listitem')).toHaveCount(4)

  // The link without its token shows nothing.
  await page.goto(orderUrl.replace(/token=[^&]+/, 'token=wrong'))
  await expect(page.getByText(t('orders.notFoundTitle'), { exact: true })).toBeVisible()
})

test('staff cancel an order before it ships; the customer sees the refund', async ({ page }) => {
  const t = copy('en')
  const { number, orderUrl } = await buy(page, 'en', t)
  expect((await page.request.post('/api/users/login', { data: STAFF })).ok()).toBe(true)
  await page.goto(`/ops/orders/${number}/`)
  await page.getByText(t('ops.cancel'), { exact: true }).first().click()
  await page.getByLabel(t('ops.cancelReason')).fill('Customer asked to cancel')
  await page.getByRole('button', { name: t('ops.cancel') }).click()
  await expect(page.getByRole('status')).toHaveText(t('ops.results.cancelled'))
  await page.goto(orderUrl)
  await expect(
    page.getByRole('list', { name: t('orders.progress') }).getByText(t('orders.steps.cancelled')),
  ).toBeVisible()
  await expect(page.getByRole('status')).toContainText(
    t('orders.refund.refunded', { amount: '' }).split(' ')[0] ?? '',
  )
})
