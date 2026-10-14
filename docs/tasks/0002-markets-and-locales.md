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

- [ ] `/ae/ar/` renders with `dir="rtl"` and mirrored header; `/ae/en/` with `dir="ltr"`.
- [ ] `/xx/en/` and `/ae/fr/` return 404 with the market switcher.
- [ ] `/brand?bid=13` returns 301 to the target stored in `LegacyRedirects`.
- [ ] `formatMoney` tests: AED 2 dp, KWD 3 dp, Arabic locale still Western digits; `vatShare(57500_00, 5)` = 2738.10.
- [ ] `hreflang` pairs emitted for every live market × locale, `x-default` = `/ae/en/`.
- [ ] Unit and integration tests for middleware and the Markets seed pass in CI.
