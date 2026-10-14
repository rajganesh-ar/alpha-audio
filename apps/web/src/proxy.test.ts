import { NextRequest } from 'next/server'
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The proxy's two database-backed steps are replaced here; their logic has its own tests
// (packages/payload markets + legacy, and the integration suite against Postgres).
const isRoutableMarket = vi.fn<(market: string, locale: string) => Promise<boolean>>()
const lookupLegacy = vi.fn<(url: URL) => Promise<{ location: string; status: 301 | 302 } | null>>()
vi.mock('./lib/marketCheck', () => ({ isRoutableMarket }))
vi.mock('./lib/legacy', () => ({ lookupLegacy }))

const { proxy, config } = await import('./proxy')

const ORIGIN = 'https://alphaaudios.com'
const request = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(new URL(path, ORIGIN), { headers })

beforeEach(() => {
  isRoutableMarket
    .mockReset()
    .mockImplementation(async (m, l) => m === 'ae' && (l === 'en' || l === 'ar'))
  lookupLegacy.mockReset().mockResolvedValue(null)
})

describe('proxy', () => {
  it('sends / to the default market', async () => {
    const res = await proxy(request('/'))
    expect(res.status).toBe(308)
    expect(res.headers.get('location')).toBe(`${ORIGIN}/ae/en/`)
  })

  it.each([['/ae/en/'], ['/ae/ar/'], ['/ae/ar/brands/']])('lets %s through', async (path) => {
    const res = await proxy(request(path))
    expect(res.headers.get('x-middleware-next')).toBe('1')
    expect(res.headers.get('x-middleware-rewrite')).toBeNull()
  })

  it.each([['/xx/en/'], ['/ae/fr/'], ['/sa/en/'], ['/foo/bar/']])(
    'rewrites %s to the server-rendered 404',
    async (path) => {
      const res = await proxy(request(path))
      expect(res.headers.get('x-middleware-rewrite')).toBe(`${ORIGIN}/_not-found`)
    },
  )

  it('falls through to the layout if the Markets record cannot be read', async () => {
    isRoutableMarket.mockRejectedValueOnce(new Error('db down'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await proxy(request('/ae/en/'))
    expect(res.headers.get('x-middleware-next')).toBe('1')
    expect(error).toHaveBeenCalledWith('market_check_failed', expect.any(Error))
    error.mockRestore()
  })

  it('301s a legacy URL found in LegacyRedirects', async () => {
    lookupLegacy.mockResolvedValueOnce({ location: '/ae/en/brands/mcintosh/', status: 301 })
    const res = await proxy(request('/brand?bid=13'))
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe(`${ORIGIN}/ae/en/brands/mcintosh/`)
    expect(lookupLegacy.mock.calls[0]?.[0].search).toBe('?bid=13')
  })

  it('lets a legacy miss fall through to the 404', async () => {
    const res = await proxy(request('/brand?bid=999'))
    expect(res.headers.get('x-middleware-next')).toBe('1')
  })

  it('does not look up URLs without a legacy key', async () => {
    await proxy(request('/brand?utm_source=x'))
    await proxy(request('/ae/en/?bid=13'))
    expect(lookupLegacy).not.toHaveBeenCalled()
  })

  it('sets suggestedMarket from cf-ipcountry and never redirects for it', async () => {
    const res = await proxy(request('/ae/en/', { 'cf-ipcountry': 'SA' }))
    expect(res.headers.get('x-middleware-next')).toBe('1')
    const cookie = res.cookies.get('suggestedMarket')
    expect(cookie).toMatchObject({ value: 'sa', path: '/', sameSite: 'lax', secure: true })
    expect(cookie?.httpOnly).toBeFalsy()
  })

  it('does not rewrite the cookie when it already holds the suggestion', async () => {
    const res = await proxy(
      request('/ae/en/', { 'cf-ipcountry': 'SA', cookie: 'suggestedMarket=sa' }),
    )
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('sets no cookie outside the GCC', async () => {
    const res = await proxy(request('/ae/en/', { 'cf-ipcountry': 'GB' }))
    expect(res.headers.get('set-cookie')).toBeNull()
  })
})

describe('proxy matcher', () => {
  const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url })

  it.each([
    ['/'],
    ['/ae/en/'],
    ['/ae/ar/brands/'],
    ['/brand?bid=13'],
    ['/index.php?bid=1'],
    ['/administrator'],
  ])('runs on %s', (url) => expect(matches(url)).toBe(true))

  it.each([
    ['/admin'],
    ['/admin/collections/users'],
    ['/api/users/me'],
    ['/_next/static/chunks/app.js'],
    ['/favicon.ico'],
    ['/media/hero.webp'],
    ['/robots.txt'],
  ])('skips %s', (url) => expect(matches(url)).toBe(false))
})
