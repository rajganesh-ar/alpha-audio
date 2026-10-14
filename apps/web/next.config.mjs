import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Storefront URLs end in a slash (/ae/en/brands/); Payload's /admin and /api do not. Next's
  // global trailingSlash would rewrite both, so it is off and src/proxy.ts adds the slash to
  // storefront paths only.
  skipTrailingSlashRedirect: true,
  experimental: {
    // One 404 page for unmatched URLs and for an unknown market/locale (the storefront has
    // several root layouts, so there is no single parent not-found boundary).
    globalNotFound: true,
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
