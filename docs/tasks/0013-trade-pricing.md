# Task 0013 — Trade companies and the dealer price engine

Phase: P2 Dealer board. Depends on: 0006 (products, landed cost), 0008 (rights). Spec: Server logic → Price engine, Dealer board rules; Content and data model (B2B); Security → Identity (company users); Testing (mandatory `price.leak.test.ts`).

## Goal

Alpha's dealers, integrators and retailers each see their own price for every product, computed in `packages/core` from the rules commercial staff maintain. Neither the price nor any input to it ever reaches another company. This task builds the companies, their users, the pricing data and the engine with its trace. The partners app that shows it (the dealer board) is the next task.

## Deliverables

- **`packages/core/pricing`:** `resolvePrices(context, lines, data)`, a pure function.
  - The context is built from the session: company, channel, buyer group, market, currency, and the time.
  - The base price is the first match of: contract price → project price (registered projects arrive with the projects task, so the slot is always empty here) → the company's or group's price list → dealer list. Dealer list is RRP excluding VAT × the channel factor, or landed cost ÷ (1 − target margin) when there is no RRP.
  - A list-derived base then takes the buyer group's discount (by brand or category) and the volume break for the quantity. A stackable promotion applies last. Rounding is half up to the currency's decimals.
  - Margin floor: a unit below `landedCost ÷ (1 − floor)` (converted at the FX rate from PricingSettings) returns `needs-approval`.
  - Products not on sale to the company's market return `unavailable`.
  - VAT is added on top for trade (`total × rate ÷ 100`).
  - Every line carries a trace: each rule with seen, matched and value.
  - Also: `stockBand(units, visibility)` (exact; banded `10+` / `3–9` / `Low` / `0`; hidden).
  - Unit tested to 90%+.
- **Collections** (migration included; Trade group in the admin):
  - `Companies`: name, market, channel (`dealer` | `integrator` | `retailer`), tier, buyer group, price list, credit limit, terms, hold, settings (stock visibility, minimum order value, order multiple, free-freight threshold, drop-ship).
  - `CompanyUsers`: Payload auth with email and password. Fields: company, role (`owner` | `purchaser` | `viewer` | `installer`), approval threshold.
  - `BuyerGroups` (discounts by brand or category), `PriceLists` (market, items, validity; drafts), `ContractPrices` (company, SKU, price, validity) and `PriceRules` (volume breaks and promotions; validity, markets, stackable).
  - The `PricingSettings` global: channel factors, target margin, margin floor, FX rates to AED.
  - Products gain `markets[].mapExclVat`, and a validation hook refuses an RRP below MAP × (1 + VAT).
- **Access:**
  - Company users read their own company, and its users, only.
  - Credit limit, settings and terms are readable by staff and the company's own owner or purchaser.
  - Pricing collections and settings are staff only.
  - Cost stays field-restricted.
- **`packages/payload/system/pricing`:** `loadPricingData(payload, company, skus)` (system read) and `resolveForSession(payload, user, lines)`. The context comes only from the signed-in company user; the API never accepts a company id.
- **Mandatory test `price.leak.test.ts`:** two companies sign in. Neither can read the other's prices (contracts, price lists, resolved prices), stock setting, credit or users. Quotes are covered when they exist. A staff-versus-company check is included.

## Acceptance criteria

- [x] For a sample of products, the resolved trade price matches a hand-computed table for each rule: contract, price list, dealer list with group discount and volume break, promotion, landed-cost list, margin floor (`needs-approval`) and not on sale (`unavailable`). The trace explains every line.
- [x] 2-decimal and 3-decimal currencies round correctly; VAT is added at the market rate.
- [x] The resolution context comes from the session only, and no handler or service accepts a company id from the client.
- [x] `price.leak.test.ts` passes: no cross-company read of prices, rules, credit, settings or users, through the Local API or the service.
- [x] Saving an RRP below MAP × (1 + VAT) is refused with the reason.
