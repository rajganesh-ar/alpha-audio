# Task 0006 — Catalogue core, home page and product page

Phase: P2 Storefront (brought forward on request). Depends on: 0002, 0003, 0004. Spec: sections 3 (Page specifications → Home, Product detail), 5 (Catalog collections) and 4 (Design system).

## Goal

A first real storefront in `ae/en` and `ae/ar`: a home page and a product page built from Payload data and the component library, with live price incl. VAT and a stock line from the ledger.

## Deliverables

- Collections (subset of the spec, extended later):
  - `Brands`: name, slug, logo, story (localized), priceDisplay.
  - `Categories`: nested, title (localized), slug.
  - `Products`: title (localized), slug, brand, sku (unique), categories, key specs, `markets[]` (market, published, rrpInclVat in minor units, priceDisplay), media with alt (localized), status, SEO group.
  - All versioned with drafts; `cost` field-level restricted (no value shown anywhere public).
- Home (ISR) from a `Home` global:
  - hero (poster image, headline, CTA);
  - three entry cards (Advisor, Room Lab, Builder) linking to placeholders;
  - featured products with price incl. VAT and stock line;
  - fallback to top categories when nothing is featured.
- Product detail (ISR + fragment):
  - gallery (next/image, `sizes`, LCP `priority`);
  - title and brand;
  - `PriceBlock` (price incl. VAT, VAT note, request-price variant);
  - stock line streamed from `LedgerService.sellable` as a server-component fragment (`private, no-store` for the fragment);
  - specs table and breadcrumb.
  - A product not published in the market is a 404 with the switcher.
- New components with all five stories and LTR/RTL snapshots: `Hero`, `ProductCard`, `Gallery`, `SpecTable`, `EntryCard`.
- SEO: Organization + WebSite schema on home, Product + Offer (`availability` from the ledger) on the product page, hreflang/canonical via `lib/seo.ts`.
- Seed: about 12 products across 4 brands with placeholder imagery (licence-free, committed only as small optimised files or generated), English and draft Arabic copy.

## Acceptance criteria

- [x] `/ae/en/` and `/ae/ar/` render the home page from Payload with no hard-coded copy; RTL mirrors.
- [x] `/ae/en/products/{slug}/` shows price incl. VAT formatted by `formatMoney` and a stock line that changes when the ledger changes (without a rebuild).
- [x] A product unpublished in `ae` returns 404 with the switcher; publishing it revalidates the page.
- [x] Product JSON-LD validates (schema test) and its `availability` matches `sellable`.
- [x] Lighthouse on the product page (mobile, local production build): LCP ≤ 2.5 s, CLS ≤ 0.1, no a11y violations. (Devtools throttling; see ADR 0006 for the simulated-mode estimate.)
- [x] New components pass the five-story check, axe and the visual snapshots.
