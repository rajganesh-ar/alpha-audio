# Task 0008 — Brand rights per market, brand index and brand pages

Phase: P2 Storefront (brought forward on request). Depends on: 0006, 0007. Spec: sections 3 (Page specifications → Brand index, Brand page), 5 (Catalog → BrandAgreements) and the GCC market layer (brand rights; compliance flags hide a brand).

## Goal

What Alpha may sell where is data, not a published checkbox alone. A brand is on sale in a market only under a live `BrandAgreement`, and every storefront surface follows it. The header's Brands link leads to a brand index and brand pages.

## Deliverables

- `BrandAgreements` collection:
  - Fields: brand, market, role (`distributor` | `retailer` | `none`), exclusive, validFrom, validTo, leadRouting (`alpha` | `dealer`), complianceFlags[], notes.
  - Access: staff read and write (commercial); delete `nobody`, agreements are ended with `validTo`.
  - Validation: `validTo` after `validFrom`; no two agreements for the same brand and market overlap in time.
  - Migration included.
- `packages/core/catalog/rights`:
  - `liveAgreement(agreements, brand, market, now)`. An agreement is live when its role is not `none`, `now` falls in `[validFrom, validTo)`, and no blocking compliance flag is set (`origin-restriction`, `registration-pending`).
  - When several are live, a distributor wins over a retailer, then exclusive.
  - `overlaps()` for validation. Fully unit tested.
- A system reader (`packages/payload/system/marketRights`) that returns only the public projection (brand id → live or not, per market). Agreements stay staff-only; anonymous callers never read them.
- Storefront visibility = published in the market **and** the brand has a live agreement there. This applies to:
  - the product page (404 with the switcher otherwise);
  - listings and facet counts;
  - home featured;
  - hreflang alternates.
    Agreement changes expire the catalogue tag.
- Brand index `/{m}/{l}/brands/` (ISR): brands with live rights, grouped by the top-level categories their products sell in, as a tile grid (logo or wordmark, product count). Brands without rights in the market are hidden.
- Brand page `/{m}/{l}/brands/{slug}/` (ISR):
  - Hero with name and story.
  - Product families: the brand's products sold in the market, grouped by top-level category.
  - A link to the brand-filtered shop listing.
  - Request-price brands show "Price on request" on cards.
  - `Brand` JSON-LD.
  - A 404 with the switcher when the brand has no live rights in the market.
  - Systems, projects and journal sections are omitted until those collections exist.
- `BrandTile` component with five stories, axe and LTR/RTL snapshots.
- Seed: agreements for the four demo brands in `ae` and `sa`, plus one brand whose UAE agreement has ended.

## Acceptance criteria

- [x] `/ae/en/brands/` and `/ae/ar/brands/` list exactly the brands with a live agreement in `ae`, grouped by category; a brand whose agreement ended, has role `none`, or carries a blocking compliance flag is absent.
- [x] `/ae/en/brands/{slug}/` shows the brand's products sold in `ae` and links to `/shop/?brand={slug}`; a brand without live rights returns 404 with the switcher.
- [x] A product of a brand without live rights in `ae` is not listed, not counted in facets, not featured, and its page returns 404, even when the product is published in `ae`.
- [x] Overlapping agreements for the same brand and market are refused; `validTo` must follow `validFrom`.
- [x] Anonymous and non-staff requests cannot read `BrandAgreements`; the storefront reads only the public projection.
- [x] `Brand` JSON-LD validates (schema test); the new component passes the five-story check, axe and visual snapshots.
