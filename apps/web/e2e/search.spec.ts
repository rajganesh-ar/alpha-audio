import { expect, test } from '@playwright/test'
import { copy } from './copy'

/**
 * Search, legal pages, sitemaps and robots (docs/tasks/0011), JavaScript off. Uses the demo
 * catalogue (seed:catalog) and the legal pages (seed:content).
 */

test('search in ae/en: header link, results with prices, a typo, and zero results', async ({
  page,
}) => {
  const t = copy('en')
  await page.goto('/ae/en/')
  await page
    .getByRole('link', { name: t('ui.search') })
    .first()
    .click()
  await expect(page).toHaveURL(/\/ae\/en\/search\/$/)
  await expect(page.getByRole('heading', { name: t('search.popular') })).toBeVisible()

  await page.getByRole('searchbox', { name: t('search.label') }).fill('mcintosh amp')
  await page.getByRole('button', { name: t('search.submit') }).click()
  await expect(page).toHaveURL(/\/ae\/en\/search\/\?q=mcintosh\+amp$/)
  await expect(page.getByRole('status')).toContainText('mcintosh amp')
  await expect(page.getByRole('heading', { name: 'MA352 integrated amplifier' })).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)

  await page.goto('/ae/en/search/?q=macintosh')
  await expect(page.getByRole('heading', { name: 'MA352 integrated amplifier' })).toBeVisible()

  await page.goto('/ae/en/search/?q=zzqx')
  await expect(page.getByText(t('search.noneTitle', { query: 'zzqx' }))).toBeVisible()
  await expect(page.getByRole('link', { name: 'Amplifiers' })).toBeVisible()
})

test('search in ae/ar, with and without diacritics', async ({ page }) => {
  const t = copy('ar')
  await page.goto('/ae/ar/search/?q=' + encodeURIComponent('مُضَخِّم'))
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('heading', { name: 'مضخم الصوت المتكامل MA352' })).toBeVisible()
  await page.goto('/ae/ar/search/?q=' + encodeURIComponent('مكبرات الصوت الرفية'))
  await expect(page.getByRole('heading', { name: 'مكبرات الصوت الرفّية Lumina II' })).toBeVisible()
  await expect(page.getByRole('searchbox', { name: t('search.label') })).toHaveValue(
    'مكبرات الصوت الرفية',
  )
})

test('legal pages from the footer, with contents; 404 for an unknown page', async ({ page }) => {
  const t = copy('en')
  await page.goto('/ae/en/')
  await page.getByRole('contentinfo').getByRole('link', { name: 'Returns' }).click()
  await expect(page).toHaveURL(/\/ae\/en\/legal\/returns\/$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Returns' })).toBeVisible()
  const contents = page.getByRole('navigation', { name: t('legal.contents') })
  await contents.getByRole('link', { name: 'Refunds' }).click()
  await expect(page).toHaveURL(/#section-3$/)
  const missing = await page.goto('/ae/en/legal/nothing-here/')
  expect(missing?.status()).toBe(404)

  await page.goto('/ae/ar/legal/returns/')
  await expect(page.getByRole('heading', { level: 1, name: 'الإرجاع' })).toBeVisible()
})

test('sitemaps and robots.txt', async ({ request }) => {
  const index = await request.get('/sitemap.xml')
  expect(index.ok()).toBe(true)
  expect(await index.text()).toContain('/ae/sitemap.xml</loc>')
  const ae = await (await request.get('/ae/sitemap.xml')).text()
  expect(ae).toContain('/ae/en/products/mcintosh-ma352/</loc>')
  expect(ae).toContain('/ae/ar/legal/returns/</loc>')
  expect(ae).toContain('hreflang="ar-AE"')
  // Bluesound has no live rights in the UAE in the demo data.
  expect(ae).not.toContain('/products/bluesound-node/')
  expect(ae).not.toMatch(/\/(bag|checkout|search|orders)\//)
  const robots = await (await request.get('/robots.txt')).text()
  for (const path of ['/*/*/bag/', '/*/*/checkout/', '/*/*/search/', '/ops/', '/admin', '/api/'])
    expect(robots).toContain(`Disallow: ${path}`)
  expect(robots).toMatch(/Sitemap: \S+\/sitemap\.xml/)
})

test('every header and footer link resolves', async ({ page, request }) => {
  for (const locale of ['en', 'ar']) {
    await page.goto(`/ae/${locale}/`)
    const hrefs = await page
      .locator('header a[href], footer a[href]')
      .evaluateAll((links) =>
        [...new Set(links.map((a) => a.getAttribute('href') ?? ''))].filter((h) =>
          h.startsWith('/'),
        ),
      )
    expect(hrefs.length).toBeGreaterThan(4)
    for (const href of hrefs) {
      const res = await request.get(href)
      expect(res.status(), href).toBeLessThan(400)
    }
  }
})
