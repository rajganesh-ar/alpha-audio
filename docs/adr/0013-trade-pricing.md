# ADR 0013 — Trade prices are resolved per session, from staff-only rules

- Status: Accepted
- Date: 2026-10-15
- Task: `docs/tasks/0013-trade-pricing.md`

## Context

Dealers, integrators and retailers buy at prices negotiated or derived per company. The platform's first non-negotiable after stock is that one buyer never sees another's price (the two-buyer leak test). The spec fixes the resolution order and asks for a trace on every line. Landed cost, margin and every rule are commercial secrets, even from the company the price is for.

## Decision

1. **One pure engine** (`packages/core/pricing`, `resolvePrices`).
   - The base price is the first match of: contract → project (slot reserved for project registrations) → price list (the company's, else its buyer group's) → dealer list.
   - Dealer list is RRP excluding VAT × the channel factor, or landed cost ÷ (1 − target margin) when there is no RRP.
   - Only a dealer-list base takes the buyer group's discount (brand, then category, then all), the best volume break and a plain promotion. Negotiated prices are final, except that a _stackable_ promotion applies to any base.
   - Every percentage step rounds half up to the currency's decimals.
   - A unit below `landedCost ÷ (1 − floor)`, with landed cost converted at the configured FX rate, is `needs-approval`; with no FX rate for the currency, the floor is not checked.
   - Trade prices are net, with VAT added on top per line (`vatOnNet`).
   - Each line carries a trace: every rule, whether it was looked at, whether it matched, and what it gave.
2. **The context is the session.**
   - `resolveForSession(payload, user, lines)` reads the company from the signed-in company user's record and the market's currency, decimals and VAT from the Markets record.
   - No function takes a company id from a caller, and anyone who is not a company user gets no trade price.
3. **Rules are staff-only.**
   - Contract prices, price lists, buyer groups, price rules and pricing settings are read only by staff (and by the system loader with `overrideAccess`, which returns only the outcome).
   - Companies see their price and trace, never the rule documents or landed cost.
4. **Company scope lives in access functions.**
   - `staffOrOwnCompany` and `staffOrColleagues` restrict companies and their users.
   - Field access (`canReadCompanyTerms`) limits credit, terms and order settings to staff and the company's own owner or purchaser.
   - Payload refuses queries on fields the user cannot read, so filtering cannot be used to probe another company's credit.
5. **Company users are a Payload auth collection** (email and password, 24-hour tokens, lockout after 5 failures). Staff create them; the partners app (next task) signs them in.
6. **MAP is enforced at save.** An RRP below MAP + VAT for its market is refused with the minimum it must reach.

## Consequences

- `price.leak.test.ts` covers companies, users, credit, settings, rules and resolved prices. Quotes join it when they exist.
- Volume breaks and promotions are one `PriceRules` collection; group discounts live on the group. More rule kinds (bundles, tiered list prices) extend the engine and its trace without changing the session contract.
- Prices changing on a date notify affected companies 7 days ahead (spec). That needs the notification outbox's company channel, which arrives with the dealer board.
