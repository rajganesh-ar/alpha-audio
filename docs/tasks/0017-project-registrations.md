# Task 0017 — Project registrations and project prices

Phase: P2 Dealer board. Depends on: 0013 (price engine), 0015 (dealer orders), 0016 (quotes). Spec: Content and data model (B2B `ProjectRegistrations`), Price engine (contract → **project** → price list → …), Partner API (`/projects`, `/price/resolve` with project), Dealer board (projects), Components (ProjectRegistrationForm).

## Goal

A dealer registers a project they are pursuing (end customer, site, expected close, products and quantities). Alpha's commercial team approves it with a project price per product for a validity period, or rejects it. While approved, the dealer orders or quotes "for this project" and the engine prices those products at the project price: after any contract price, before price lists and the dealer list, with the trace saying so. Allocations (reserving stock per project) are P4.

## Deliverables

- **Price engine:** `PricingData.projectPrices` fills the reserved `project` slot. A matching SKU sets the base with basis `project`, unless a contract price already did. List adjustments (group discount, volume, plain promotions) do not apply to it; a stackable promotion and the margin floor still do. Unit tested.
- **`packages/core/projects`:** `ProjectService` with `register`, `decide` and `withdraw`.
  - `register` validates name, end customer, expected close and lines (whole quantities, at most 100 lines), and is idempotent on the company-scoped key.
  - `decide` (staff) approves with a project price for any of the lines and a validity of 1 to 365 days, or rejects with a reason.
  - `withdraw` is open to the company while the project is submitted or approved.
  - Statuses: `submitted`, `reviewing` (claim), `approved`, `rejected`, `withdrawn`, `expired`. An approved project past its validity reads as expired.
  - Every change is a compare-and-set. `projectPrices(project, at)` returns the prices in force.
- **`ProjectRegistrations` collection** (Trade group; migration; number sequence `P-AE-2026-000001`):
  - Fields: company, registered by, market, status, name, end customer, city, expected close, note, lines (SKU, product, title, quantity, approved project price), valid until, decided by and at, decision note, idempotency key, staff notes.
  - System-written. Staff read all; company users read their own company's.
  - Approved prices are visible to the company that registered the project only (company scope).
- **Orders and quotes for a project:**
  - `TradeOrders.project` and `Quotes.project` (the project number), with a migration.
  - `priceDraft`, `previewTradeOrder`, `placeTradeOrder` and `createQuoteFromDraft` take an optional project. It is honoured only when it is the user's own company's project, approved, in date and in the company's market; otherwise the order or quote is refused with `project-unavailable`.
- **Partners app:**
  - `/projects`: the company's projects.
  - `/projects/new`: `ProjectRegistrationForm`, a plain form.
  - `/projects/{number}`: status, lines with approved prices, valid until, decision note, "Order for this project" (opens the order review with the project and its lines) and "Withdraw".
  - The order review shows the project and keeps it through review, order and quote.
  - Partner API:
    - `GET` and `POST /api/v1/projects` (idempotent);
    - `POST /api/v1/projects/{number}/withdraw`;
    - `POST /api/v1/price/resolve` accepts `project`.
- **Web ops:** `/ops/projects/` lists submitted registrations, and the detail page sets a price per line, the validity and a note, then approves or rejects. Through `POST /api/v1/ops/projects/{number}/{approve|reject}` (staff session).
- **UI:** `ProjectRegistrationForm` (five stories); `QuickOrder` carries hidden fields (the project) through the review.
- **Tests:**
  - Engine unit tests for the project slot.
  - `ProjectService` unit tests.
  - Integration (`projects.integration.test.ts`):
    - register, approve and order at project prices with the trace;
    - another company's project, an expired or rejected project refused;
    - company isolation;
    - the ops endpoint.
  - End to end: a dealer registers a project, staff approval is seeded through the service, the dealer orders for the project at the project price.
- **Docs:** ADR 0017 (project prices in the engine; registrations reviewed by staff), runbook `project-registrations.md`.

## Acceptance criteria

- [x] A dealer registers a project with lines; staff approve it with project prices and a validity.
- [x] Ordering or quoting for an approved, in-date project of one's own company prices its products at the project price (after contracts), and the trace says "Project price".
- [x] Another company's project, or a rejected, withdrawn or expired one, is refused and never priced.
- [x] A company never sees another company's projects or project prices.
- [x] Below-floor project prices still need Alpha's approval when ordered.
