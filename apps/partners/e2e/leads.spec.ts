import { expect, test, type Page } from '@playwright/test'

/**
 * Leads (docs/tasks/0018) on the board, JavaScript off. seed:trade sends a fresh enquiry from
 * Dubai for Lumina II and routes it to Harmony (who serves Dubai) each time it runs.
 */
const PASSWORD = 'partners-demo-123'

async function signIn(page: Page, email: string) {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/catalogue$/)
}

test('a dealer accepts a routed lead, then sees the contact and records the outcome', async ({
  page,
}) => {
  await signIn(page, 'owner@harmony.example')
  await page.getByRole('link', { name: 'Leads' }).click()
  const card = page
    .getByRole('article')
    .filter({ hasText: 'Waiting for you' })
    .filter({ hasText: 'Lumina II' })
    .first()
  await expect(card).toContainText(/Accept by .+ · about \d+ hours left/)
  await expect(card).toContainText('Dubai')
  // The shopper's name and address are not shown before acceptance.
  await expect(card).not.toContainText('Mariam')
  await expect(card.getByRole('link', { name: /@/ })).toHaveCount(0)
  const number = (await card.locator('.font-mono').textContent()) ?? ''

  await card.getByRole('button', { name: 'Accept' }).click()
  await expect(page.getByRole('status')).toHaveText(
    'You accepted the lead. The shopper’s details are below.',
  )
  const accepted = page.getByRole('article').filter({ hasText: number })
  await expect(accepted).toContainText('Accepted')
  await expect(accepted).toContainText('Mariam')
  await expect(accepted.getByRole('link', { name: /@example\.com$/ })).toBeVisible()

  await accepted.getByLabel('Value (net, optional)').fill('9000')
  await accepted.getByRole('button', { name: 'Won' }).click()
  await expect(page.getByRole('status')).toHaveText('The outcome was recorded.')
  await expect(page.getByRole('article').filter({ hasText: number })).toContainText('Won')
})

test('another company never sees the lead', async ({ page }) => {
  await signIn(page, 'owner@gulf-integrators.example')
  await page.goto('/leads')
  await expect(page.getByText(/Mariam/)).toHaveCount(0)
})
