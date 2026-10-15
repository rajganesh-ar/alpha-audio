import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/seo'

/** Per-visitor and staff paths stay out of search engines (spec: sitemap and robots). */
export const ROBOTS_DISALLOW = [
  '/*/*/bag/',
  '/*/*/checkout/',
  '/*/*/orders/',
  '/*/*/account/',
  '/*/*/search/',
  '/*/*/enquire/',
  '/ops/',
  '/admin',
  '/api/',
] as const

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: [...ROBOTS_DISALLOW] }],
    sitemap: new URL('/sitemap.xml', siteUrl()).toString(),
  }
}
