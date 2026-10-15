import { withPayload } from '@payloadcms/next/withPayload'

/**
 * The dealer board (docs/tasks/0014, ADR 0014). Every response is per-company: never cached by
 * a browser, CDN or proxy, and never indexed (CLAUDE.md rule 4; spec: dealer board rendering).
 */
const PRIVATE_HEADERS = [
  { key: 'Cache-Control', value: 'private, no-store' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: PRIVATE_HEADERS }]
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
