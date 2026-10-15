# Task 0007 — Category listing and shop index

Phase: P2 Storefront (brought forward on request). Depends on: 0006. Spec: sections 3 (Page specifications → Category listing; Routing rules), 4 (Component inventory → Discovery) and Performance, SEO and accessibility standards.

## Goal

Finish the browse path: header "Products" and the home page's category cards lead to a real listing with facets, sort and pagination, in `ae/en` and `ae/ar`, without giving up edge caching for the unfiltered pages.

## Deliverables

- Routes:
  - `/{m}/{l}/shop/`: every product published in the market, with the top categories.
  - `/{m}/{l}/shop/{category}/` and `/{m}/{l}/shop/{category}/{subcategory}/`: the category and its descendants. A subcategory that is not a child of the category is a 404.
  - The interim category page from 0006 is replaced. The header's Products link goes to `/shop/`.
- Rendering:
  - Unfiltered listing pages are ISR (tags as in ADR 0006).
  - A URL with listing parameters (`brand`, `price`, `stock`, `spec.*`, `sort`, `page`) is rewritten by `proxy.ts` to a dynamic twin of the same page. Filtered results are therefore computed per request, and the unfiltered page stays cacheable.
  - The twin's internal path is not reachable directly.
- `packages/core/catalog/listing`:
  - Filters: brand, price band, in stock, spec values.
  - Disjunctive facet counts: each facet is counted with every other filter applied.
  - Price bands are derived from the result prices and rounded to readable numbers.
  - Sort: featured, price ascending and descending (price-on-request last), newest, name (locale collation).
  - Pagination, 24 per page.
  - Pure and fully unit tested.
- `Categories.facetSpecs`: which spec fields a category offers as facets (channels, nominal impedance, sensitivity). Migration included.
- Components, each with five stories, axe and LTR/RTL snapshots:
  - `FacetRail`: a GET form that works without JavaScript, with an explicit Apply button (no change of context on input). It is a disclosure on mobile and always open from `lg`.
  - `SortMenu`: a labelled select bound to the facet form.
  - `Pagination`: links, `aria-current`, previous/next chevrons that mirror in RTL.
- Product cards as on the home page: price incl. VAT and the live stock line.
- States:
  - Zero results: an empty state with clear-filters and suggested categories.
  - Out-of-market products are never listed or counted.
- SEO:
  - `ItemList` JSON-LD of the page's products.
  - Canonical: a filtered page is canonical to the unfiltered one; page N is canonical to itself.
  - `rel=prev/next` on paginated pages; filtered pages `noindex, follow`.
  - hreflang as elsewhere.

## Acceptance criteria

- [x] `/ae/en/shop/`, `/ae/en/shop/amplifiers/` and `/ae/en/shop/amplifiers/integrated-amplifiers/` render in both locales; a wrong parent/child pair and an unknown category return 404.
- [x] Filtering by brand, price band, in stock and a spec value narrows results; facet counts are disjunctive and never include products unpublished in the market.
- [x] Sorting by price puts price-on-request products last in both directions; name sort follows the locale.
- [x] Unfiltered listing responses carry the ISR cache header; filtered ones are dynamic, `noindex`, and canonical to the unfiltered URL; direct requests to the internal twin path 404.
- [x] The facet form works with JavaScript disabled; keyboard and screen reader names are correct; axe passes in both directions.
- [x] Pagination emits `rel=prev/next`, keeps the active filters, and page N > last returns 404.
- [x] New components pass the five-story check, axe and the visual snapshots.
