import { describe, expect, it } from 'vitest'
import robots, { ROBOTS_DISALLOW } from '@/app/robots'

describe('robots.txt', () => {
  it('keeps every private path out and points at the sitemap index', () => {
    const env = process.env['NEXT_PUBLIC_SERVER_URL']
    process.env['NEXT_PUBLIC_SERVER_URL'] = 'https://www.alphaaudios.com'
    try {
      const result = robots()
      expect(result.sitemap).toBe('https://www.alphaaudios.com/sitemap.xml')
      for (const path of [
        '/*/*/bag/',
        '/*/*/checkout/',
        '/*/*/orders/',
        '/*/*/account/',
        '/*/*/search/',
        '/ops/',
        '/admin',
        '/api/',
      ]) {
        expect(ROBOTS_DISALLOW).toContain(path)
      }
      expect(result.rules).toEqual([{ userAgent: '*', allow: '/', disallow: [...ROBOTS_DISALLOW] }])
    } finally {
      process.env['NEXT_PUBLIC_SERVER_URL'] = env
    }
  })
})
