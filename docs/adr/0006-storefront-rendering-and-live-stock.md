# ADR 0006 — Storefront rendering, catalogue caching and the live stock line

- Status: Accepted
- Date: 2026-10-15
- Task: `docs/tasks/0006-storefront-home-and-product.md`

## Context

The home and product pages must be fast from the Gulf (ISR, edge-cacheable), show a price incl. VAT, and show a stock line that follows the ledger without a rebuild. A product not sold in a market is a 404 with the market switcher, and publishing must take effect at once. The spec calls the stock line a "fragment" inside an ISR page.

## Decision

### 1. ISR pages, tagged data, immediate expiry on publish

- Home, product and category pages are ISR: rendered on first request, and re-rendered at most every five minutes (`revalidate = 300`).
- Data loaders (`apps/web/src/lib/catalog.ts`) call the Payload Local API anonymously with `overrideAccess: false`. Only published documents come back, and staff-only fields such as `cost` are stripped before anything is cached. Results are cached with `unstable_cache` under the tags `catalog` and `home`.
- `revalidateStorefront` hooks on Products, Brands, Categories and the Home global expire those tags with `revalidateTag(tag, { expire: 0 })`. Next.js 16's default profile would serve stale content once, which would keep an unpublished product on sale for one more request.
- The hook never fails a save. Outside a Next.js request (seeds, jobs, tests) there is nothing to expire, and the five-minute revalidation still applies.

### 2. The live stock line is an island fed by `/api/v1`, not a streamed fragment

Two ways to stream a per-request server fragment inside a static page were considered:

- **Cache Components (partial prerendering)** with `cacheComponents: true`. It changes caching for the whole app, admin included. Payload's support is not settled: reports include 404s returning HTTP 200, which breaks our 404 contract. The response also stops being cacheable at the CDN.
- **A server action returning JSX.** It breaks the rule that browsers call only `/api/v1/*`.

Instead:

- **Server-rendered line.** The page renders the stock line from the ledger at render time (`LedgerService.sellable` and `ReceivingService.openPurchaseEta`, mapped by `stockPromise` in `packages/core`). Crawlers and no-JS visitors get real HTML with no layout shift.
- **Live refresh.** `LiveStockLine` (a client island) asks `GET /api/v1/markets/{market}/stock?sku=…` on load and when the tab becomes visible again. The response is `private, no-store` and is never cached ("stock promises never"). Calls made in the same tick are batched into one request per market.
- **What the endpoint returns.** It gives a status and an ETA, never unit counts. The market comes from the URL path, as for every storefront page; no buyer context is read or accepted.
- **Accessibility.** The line is an `aria-live="polite"` region, so changes are announced.

The JSON-LD `availability` comes from the render-time promise. It is at most five minutes behind the ledger, plus any CDN `stale-while-revalidate` time. A dedicated revalidation on stock changes is not worth the coupling for that lag.

### 3. Prices and stock in `packages/core`

- `consumerPrice` returns `unavailable`, `request` or `priced`. A price is the market's `rrpInclVat` in minor units, with its VAT share computed by the platform rounding rule. The brand's `priceDisplay: request` overrides every product of the brand.
- `stockPromise` maps sellable units and an ETA to `in-stock`, `low` (2 or fewer units), `on-order` (with the date, if it is in the future) or `out`. `schemaAvailability` maps those to `InStock`, `LimitedAvailability`, `BackOrder` and `OutOfStock`.
- Components only format.

### 4. Catalogue model (subset of the spec)

- `Products`, `Brands` and `Categories` are versioned with drafts.
- Access:
  - Read is `publishedOrStaff`.
  - Create and update are `canEditCatalog`: staff, and publishing goes through `canPublish`, which becomes the `publisher` role with the access-control task.
  - Delete is `nobody`.
- Fields:
  - `cost` has field access `canReadCost`.
  - Prices sit per market in `markets[]`. Database checks keep them positive minor units, one row per market.
  - The lifecycle field is `lifecycle`, not `status`: a `status` select collides with Payload's `_status` enum name.
- Arabic copy carries `arabicReview: draft | reviewed`.

### 5. Media

- Payload serves media from S3 under `/api/media/file/…` and writes absolute URLs against `serverURL`. The storefront turns own-origin URLs into paths, so `next/image` optimises them as local images, in AVIF or WebP.
- The gallery's first image is `priority` with `fetchPriority="high"`, and every image has `sizes`.
- Demo images are drawn as SVG from the token palette and encoded at seed time, so no binaries are committed.

### 6. Mono face kept off the product page

Spec values use the body face with tabular figures. JetBrains Mono (40 KB) would otherwise load on every product page, ahead of the LCP image.

## Consequences

- A CDN in front of the app caches ISR HTML, including 404s, for `s-maxage=300`. Purging the CDN on publish arrives with the infrastructure task. Until then, a publish reaches the edge within five minutes.
- A Payload hook context object must not be shared between Local API calls: the cloud-storage plugin sets a flag on it, which made later uploads skip storage in the seed.
- Lighthouse (mobile, local production build, devtools throttling) puts LCP at 2.1–2.4 s, CLS at 0.03 or less, and accessibility at 100 on the product and home pages in both languages. The default simulated mode estimates 3.3–4.2 s in this container. Its unthrottled reference load paints the first frame at 1.3–2.3 s, while Playwright measures first paint at about 0.2 s on the same build. Lighthouse CI against staging, over HTTP/2 behind the CDN, is the performance task's gate.
