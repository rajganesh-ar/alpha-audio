# Task 0002 — Markets global, locales and market routing

Phase: P0 Foundations. Depends on: 0001. Spec: sections 2 (Sitemap) and 9 (GCC market layer).

## Goal

Every public URL is `/{market}/{locale}/…`, validated against a `Markets` global, with a working RTL shell for Arabic.

## Deliverables

- `Markets` global in `packages/payload/globals/Markets.ts` with one entry per market: `code`, `name` (localized), `currency`, `decimals`, `vatRate`, `locales[]`, `payments[]`, `addressScheme`, `fulfilment` (`alpha` | `dealer`), `status` (`live` | `soon` | `off`), `timezone`. Seed script with ae, sa, qa, kw, bh, om using the values in the spec.
- `apps/web/middleware.ts`: validates `[market]` and `[locale]` against live markets and their locales; unknown → 404; root `/` → `/ae/en/`; geo-IP header (Cloudflare `cf-ipcountry`) sets a `suggestedMarket` cookie for a dismissible banner, never a redirect.
- `app/[market]/[locale]/layout.tsx`: sets `html[lang][dir]`, loads the i18n dictionary (`packages/ui/i18n`, `en.json`, `ar.json`), renders `AppShell` with `Header`, `MarketSwitch`, `AnnouncementBar`, `Footer` stubs.
- `packages/core/money`: `Money` type (integer minor units + currency + decimals), `formatMoney(money, locale)` using `Intl.NumberFormat` with Western digits, `vatShare(totalInclusive, rate)`, `roundToDecimals`.
- `hreflang` and canonical generation helper in `apps/web/lib/seo.ts`.
- `LegacyRedirects` collection (`sourcePath`, `sourceQuery`, `target`, `status`) and middleware resolution for `?bid=` and `?catid=` URLs with a 301.

## Acceptance criteria

- [x] `/ae/ar/` renders with `dir="rtl"` and mirrored header; `/ae/en/` with `dir="ltr"`. _Checked in Chromium against `next start`: in RTL the wordmark sits at the right edge and the market switch at the left, nav order reversed; no target under 44 px._
- [x] `/xx/en/` and `/ae/fr/` return 404 with the market switcher. _Server-rendered (also `/sa/en/`, not live, and unmatched URLs); `src/proxy.test.ts`._
- [x] `/brand?bid=13` returns 301 to the target stored in `LegacyRedirects`. _Campaign parameters carried over; `src/proxy.test.ts`, integration suite._
- [x] `formatMoney` tests: AED 2 dp, KWD 3 dp, Arabic locale still Western digits; `vatShare(57500_00, 5)` = 2738.10. _`packages/core/src/price.rounding.test.ts`, `money.test.ts`._
- [x] `hreflang` pairs emitted for every live market × locale, `x-default` = `/ae/en/`. _`src/lib/seo.test.ts`; verified in the rendered `<head>`, including after switching `sa` live._
- [x] Unit and integration tests for middleware and the Markets seed pass in CI. _`src/proxy.test.ts`, `src/lib/routing.test.ts`, `tests/integration/markets-and-legacy.integration.test.ts`._

## Implementation notes

- Next.js 16 renamed middleware to proxy: the file is `apps/web/src/proxy.ts`. Invalid pairs are 404'd by the proxy (rewrite to `/_not-found`), because a `notFound()` from the root `[market]/[locale]` layout renders an empty client-side shell. See ADR 0002.
- Paths follow the `src/` layout from task 0001: `apps/web/src/app/(frontend)/[market]/[locale]/layout.tsx`, `apps/web/src/lib/seo.ts`.
- `AppShell`, `Header`, `MarketSwitch`, `AnnouncementBar` and `Footer` are stubs in `packages/ui/src/shell`. Their Storybook stories (five states each) arrive with Storybook in task 0003.
- Seed: `pnpm --filter @alpha/web seed:markets`. UAE is live; the other five are `soon` until the business confirms each launch. Arabic names and UI strings are drafts for the native reviewer.
