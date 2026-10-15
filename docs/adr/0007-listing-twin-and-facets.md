# ADR 0007 — Category listings: a dynamic twin for filtered views

- Status: Accepted
- Date: 2026-10-15
- Task: `docs/tasks/0007-category-listing.md`

## Context

Category pages are ISR so the CDN can serve them (ADR 0006). Filters, sort and pagination arrive as query parameters, and in Next.js a page that reads `searchParams` is dynamic for every request, including the unfiltered one. Filtered views also must not be indexed, must be canonical to the unfiltered page, and must work without JavaScript.

## Decision

1. **Two routes, one page.**
   - `shop/[[...path]]` is ISR and never reads the query.
   - `shop-results/[[...path]]` is its dynamic twin and does.
   - Both render `ListingPage`, so the markup and data are identical.
2. **The proxy chooses.** `decideRoute` sends `/{m}/{l}/shop/…` to the twin when the URL carries a listing parameter: `brand`, `price`, `stock`, `spec.*`, `sort` or `page`.
   - Tracking parameters do not count, so `?utm_source=` stays on the cached page.
   - No-op values a GET form submits (`price=`, `sort=featured`, `page=1`) are first removed with one 308, so a filter URL has one canonical shape.
   - A direct request for `/shop-results/…` is a 404, so the twin has no public address of its own.
3. **The listing engine is pure** (`packages/core/catalog/listing`):
   - Filters, disjunctive facet counts and pagination over items whose price and stock are already resolved.
   - Price bands are derived from the result prices (quartile edges rounded to 1, 2, 2.5 or 5 × 10ⁿ in major units). The URL carries major units: `price=10000-25000`.
   - Sorts put price-on-request items last in both price directions.
4. **Spec facets are configured per category** (`Categories.facetSpecs`, inherited from the nearest ancestor). Only discrete values are offered; a facet with a single value is hidden.
5. **Forms, not scripts.**
   - `FacetRail` is a GET form with an explicit Apply button (WCAG 3.2.2).
   - `SortMenu` is bound to it through the `form` attribute.
   - Below `lg` the rail is a `<details>` disclosure; from `lg` it is forced open with `::details-content`, and its summary is hidden only where that is supported.
6. **SEO.**
   - A filtered or re-sorted view is `noindex, follow` and canonical to the unfiltered listing.
   - A plain page N is indexable, canonical to itself, and linked with `rel=prev/next`, which React 19 hoists into `<head>`.
   - `ItemList` JSON-LD on every listing.

## Consequences

- Filtered views are computed per request, with fresh stock (`private, no-store`), on top of the cached catalogue loaders. Unfiltered views keep the five-minute ISR lag of ADR 0006.
- Listings read up to 1,000 products per category and resolve stock per SKU. A batched `sellable` read in the ledger is the follow-up once catalogues grow.
- Two layout-shift sources found on Arabic pages were removed:
  - Card titles reserve two lines.
  - Category pills form one scrolling row on small screens, so a late web font cannot rewrap them.

  Font fallback metrics (`size-adjust`) remain the performance task's.

- `formatMoney` gains `wholeUnits` for band edges. It refuses fractional amounts, so a price is never shown rounded.
