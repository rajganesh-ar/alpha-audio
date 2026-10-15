# ADR 0008 — Brand rights decide what the storefront sells

- Status: Accepted
- Date: 2026-10-15
- Task: `docs/tasks/0008-brand-rights-and-pages.md`

## Context

Alpha distributes brands under per-market agreements that start, end, change role, and can be suspended by compliance (spec: GCC market layer). A product's own "published in market" flag cannot express any of that, and the brand index must show only brands with rights.

## Decision

1. **`BrandAgreements` is the source of rights.**
   - Fields: brand, market, role (`distributor` | `retailer` | `none`), exclusive, `[validFrom, validTo)`, lead routing, compliance flags.
   - Staff only. It is never deleted; an agreement is ended by setting `validTo`.
   - A `beforeChange` hook refuses an end at or before the start, and a window that overlaps another agreement for the same brand and market. The rule is `agreementProblems` in `packages/core`.
2. **Live is computed, not stored** (`packages/core/catalog/rights`).
   - An agreement is live when its role is not `none`, `now` is inside its window, and no blocking flag is set (`origin-restriction`, `registration-pending`). Informational flags (`arabic-labelling`, `wireless-type-approval`) do not hide.
   - When several agreements are live, a distributor beats a retailer, then exclusive beats non-exclusive.
3. **The storefront reads a projection.**
   - `system/marketRights.ts` reads agreements with `overrideAccess: true`, which is allowed because it lives in `packages/payload/system/` and carries its reason.
   - It returns only `{ brand, market, from, to }` for agreements that can sell. Roles, exclusivity, routing and notes never leave the server, and anonymous REST calls get 403.
4. **One sale rule everywhere.**
   - `onSale(product, market)` is true when the product is published in the market and its brand has a live window there.
   - The product page (404 with the switcher), listings and facet counts, home featured, the brand index and brand pages, and hreflang alternates all use it.
   - Agreement changes expire the `catalog` tag.

## Consequences

- An agreement that starts or ends on a date takes effect on the storefront within the ISR window (five minutes) of that instant. There is no scheduled revalidation for date boundaries yet.
- Products of a brand without rights stay published but hidden. Re-signing the brand brings them back without touching products.
- Lead routing (`leadRouting`) is stored now and used by the leads task. Dealer ordering into a market will use the same live check.
- The demo seed ends Bluesound's UAE agreement on 30 June 2026, so the UAE storefront shows three brands. That is intentional.
