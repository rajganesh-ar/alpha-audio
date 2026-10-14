# ADR 0002 — Market routing, 404s and legacy redirects

- Status: Accepted
- Date: 2026-10-14
- Task: `docs/tasks/0002-markets-and-locales.md`

## Context

Every public URL is `/{market}/{locale}/…`. Which markets are routable, and in which languages, is data: the `Markets` global, edited by staff, with only the UAE live at launch. Unknown or non-live pairs must 404 with a market switcher. The old site's query-string links (`/brand?bid=13`) must 301 from the `LegacyRedirects` table. Visitors from another GCC country get a suggestion, never a redirect. Content pages are ISR and must stay cacheable.

The task and CLAUDE.md assumed `middleware.ts` and a layout that 404s. Next.js 16 and the App Router changed both assumptions.

## Decision

### 1. The proxy is `apps/web/src/proxy.ts`

Next.js 16 renamed middleware to **proxy** (`proxy.ts`, exported `proxy()`, Node.js runtime); `middleware.ts` is deprecated. CLAUDE.md now says `proxy.ts`. The proxy runs on everything except `/admin`, `/api`, `/_next` and static files; `.php` and `.html` are not excluded because old-site links may use them.

The routing rules are a pure function, `decideRoute(url)` in `src/lib/routing.ts`, unit-tested without a server:

| Request                                   | Result                                                       |
| ----------------------------------------- | ------------------------------------------------------------ |
| `/`                                       | 308 → `/ae/en/` (query kept)                                 |
| `/ae`, `/ae/`                             | 308 → `/ae/en/`                                              |
| `/AE/AR`, `/ae/en/brands`                 | 308 → canonical form in one hop (lower-case codes, slash)    |
| `/{market}/{locale}/…`, market code known | check against the Markets record; not routable → 404         |
| `/xx/en/`, `/foo/bar/` (no market code)   | 404                                                          |
| any other path with `bid` or `catid`      | LegacyRedirects lookup → 301/302, or fall through to the 404 |
| anything else                             | Next.js routes it, or renders the global 404                 |

### 2. 404s are a proxy rewrite to `/_not-found`, not a `notFound()` in the layout

`app/(frontend)/[market]/[locale]/layout.tsx` is a **root layout** (it owns `<html lang dir>`). A `notFound()` thrown there, or in its page, has no not-found boundary above it. Next.js 16 then sends status 404 with an **empty `<html id="__next_error__">` shell** and builds the not-found UI in the browser from the RSC payload. Crawlers and no-JS visitors see a blank page. Verified in `next build` + `next start`.

So the proxy checks `/{market}/{locale}/` against the Markets record and rewrites invalid pairs to Next's reserved `/_not-found` route. That renders `app/global-not-found.tsx` (`experimental.globalNotFound`) on the server with status 404, in both languages, with every live market × locale in the switcher. Unmatched URLs reach the same page natively.

The layout keeps a backstop. For an invalid pair it renders a bare document with no shell, and the page's `requireMarketRoute()` 404s. This covers a record that cannot be read in the proxy, and never leaks the shell of a non-live market.

### 3. The proxy reads the record through Payload, from a process-wide cache

Payload caches its instance on `globalThis`, and the Node.js proxy runs in the app's process, so `getPayload()` in the proxy reuses the app's instance and pool. The Markets record is cached for 30 s on `globalThis` (`Symbol.for('alpha.marketsCache')`), not in a module variable. Next bundles the proxy and the app separately, so a module variable would give each its own copy, and the save hook would clear only one. Concurrent misses share one read; a failed read is not cached. Verified end to end: switching `sa` live through the REST API made `/sa/ar/` routable on the next request.

Payload is imported lazily (`await import('./lib/marketCheck')`, `'./lib/legacy'`), so the proxy's own module stays small and URLs that need no lookup never touch it.

If a future host runs the proxy in an isolated runtime, it gets its own Payload instance. The worst case is then 30 s of staleness after a market changes.

### 4. Revalidation uses `revalidatePath('/', 'layout')`

`revalidateMarkets` clears the cache and purges every storefront page. In Next.js 16 `revalidateTag` serves stale content while revalidating, and a market status or VAT rate must not be served stale. Scripts outside a Next.js request (seed, `payload run`) pass `context.disableRevalidate`.

### 5. Legacy redirects

- Only requests carrying `bid` or `catid` (`LEGACY_QUERY_KEYS`) are looked up. Path-only redirects remain the redirects plugin's job (CLAUDE.md).
- Source path and query are normalised on save and on lookup: case, trailing slash, key order, and tracking parameters (`utm_*`, `gclid`, `fbclid`, …) dropped. `/Brand/?utm_source=ig&BID=13` matches the row `/brand` + `bid=13`.
- Campaign parameters on the old link are carried onto the target, so attribution survives the hop.
- Targets must be on-site paths: the table can never become an open redirect. `(sourcePath, sourceQuery)` is unique.
- A failed lookup logs `legacy_redirect_lookup_failed` and falls through to the 404 instead of a 500.

### 6. Trailing slashes on storefront URLs only

Storefront URLs end in `/` (`x-default` is `/ae/en/`). Next's `trailingSlash: true` would also rewrite Payload's `/admin` and `/api`, so it stays off. `skipTrailingSlashRedirect: true` stops Next stripping the slash, and the proxy adds it to storefront paths.

### 7. The geo hint is a cookie read in the browser

The proxy sets `suggestedMarket` from `cf-ipcountry` (GCC countries only). It writes the cookie only when the value changes, so cached responses rarely carry `Set-Cookie`. The cookie is not `httpOnly`: the banner reads it in the browser, so the page stays ISR. Dismissal is a second cookie, `suggestedMarketDismissed`.

### 8. Data-model details forced by Payload

- A localized field stores its values in `<table>_locales`. A `hasMany` select named `locales` gets the same table name, so it needs `dbName: 'markets_markets_enabled_locales'`. It also needs an explicit `enumName`: with neither set, the enum type takes the table's name and the generator silently drops the table from the migration.
- Reading `locale: 'all'` returns no Arabic name for a row added in English only. `parseMarketsGlobal` falls back to the English name instead of throwing; otherwise one half-filled row would take the whole storefront down.

## Alternatives considered

- **Route handlers at `/brand` and `/collection`.** They can 301, but a miss can only return an empty 404 body (no switcher), and rows for any other old path would never fire.
- **`permanentRedirect()` in a page.** It returns 308, not the 301 the old site's links need.
- **A Payload-free proxy (code lists only).** It handles `/xx/en/` but not `/sa/en/` (known code, not live), which would hit the blank-shell 404.
- **Self-fetching an internal API from the proxy.** It adds an HTTP hop and an origin setting for no gain once Payload runs in the proxy.

## Consequences

- Every storefront request does one in-memory lookup in the proxy; database reads are bounded to one per 30 s per process.
- New top-level routes outside `/{market}/{locale}/` with two or more segments must be added to `decideRoute`. Otherwise the proxy 404s them.
- The proxy depends on Next's reserved `/_not-found` route. `src/proxy.test.ts` pins the rewrite target; that Next renders it server-side with status 404 was checked against `next start`, and must be re-checked on every Next.js upgrade (`curl -i /xx/en/` should return 404 with the switcher in the HTML).
- Seeded values to confirm with the business: every market except `ae` is `soon`; `sa` defaults to `dealer` fulfilment; VAT and decimals follow the spec; all Arabic names and UI strings are drafts for the native reviewer.
- Running `pnpm dev` and `next start` against the same database makes `next start` stop at Payload's "dev mode push" prompt. Use a separate database for production-mode checks (README).
