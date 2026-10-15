import { describe, expect, it } from 'vitest'
import { readFields, seeOther, withQuery } from './forms'
import { crossSite } from './respond'

describe('storefront forms', () => {
  it('reads urlencoded forms and JSON objects, and nothing else', async () => {
    const formRequest = new Request('http://x/', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'sku=A&qty=2',
    })
    expect(await readFields(formRequest)).toEqual({ sku: 'A', qty: '2' })
    const json = (body: string) => new Request('http://x/', { method: 'POST', body })
    expect(await readFields(json('{"sku":"A"}'))).toEqual({ sku: 'A' })
    expect(await readFields(json(''))).toEqual({})
    expect(await readFields(json('[1]'))).toBeNull()
    expect(await readFields(json('{nope'))).toBeNull()
  })

  it('answers 303 to a path, uncached, with cookies', () => {
    const res = seeOther('/ae/en/bag/?status=added', ['a=1', 'b=2'])
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/ae/en/bag/?status=added')
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(res.headers.getSetCookie()).toEqual(['a=1', 'b=2'])
    expect(withQuery('/p/', { status: 'unavailable', sku: ['A', 'B'] })).toBe(
      '/p/?status=unavailable&sku=A&sku=B',
    )
    expect(withQuery('/p/', {})).toBe('/p/')
  })

  it('refuses cross-site posts by Origin or Sec-Fetch-Site', () => {
    const post = (headers: Record<string, string>) =>
      new Request('http://shop.example/api', {
        method: 'POST',
        headers: { host: 'shop.example', ...headers },
      })
    expect(crossSite(post({ origin: 'http://shop.example' }))).toBe(false)
    expect(crossSite(post({ origin: 'https://evil.example' }))).toBe(true)
    expect(crossSite(post({ 'sec-fetch-site': 'cross-site' }))).toBe(true)
    expect(crossSite(post({}))).toBe(false)
  })
})
