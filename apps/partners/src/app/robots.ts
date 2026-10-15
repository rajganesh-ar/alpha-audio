import type { MetadataRoute } from 'next'

/** Nothing on the partners domain is for search engines (spec: robots disallows `partners.`). */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', disallow: '/' }] }
}
