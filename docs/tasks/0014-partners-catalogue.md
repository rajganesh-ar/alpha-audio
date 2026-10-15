# Task 0014 — Dealer board: partners app, sign-in and catalogue with own prices

Phase: P2 Dealer board. Depends on: 0013 (companies, company users, price engine), 0008 (rights), 0004 (ledger), 0005 (purchase ETAs). Spec: Information architecture (dealer board on `partners.alphaaudios.com`), Rendering (dealer board: dynamic, no cache, `X-Robots-Tag: noindex`), Components (Dealer: CompanyHeader, PartnerCatalogueTable, PriceTraceDrawer), Partner API (`/catalogue`, `/price/resolve`), Dealer board rules (stock visibility).

## Goal

A dealer signs in on the partners domain with their company user's email and password and sees the catalogue of their market with their own price, the consumer RRP beside it, why the price is what it is, and stock as their company may see it. The partners app is its own Next.js deployment on its own domain and cookie, sharing the database and every collection, access rule and service with the web app. Ordering, quotes, projects and leads are later tasks.

## Deliverables

- **Shared Payload configuration** (ADR 0014): `alphaConfig(options)` in `packages/payload` holds every collection, global, job, the editor, database and storage. Each app passes what differs: the admin (web only), migrations at start-up (web only), whether it works the job queues (web only), its auth cookie prefix and its generated types file. `Users` and `Media` move into `packages/payload`.
- **`apps/partners`** (`@alpha/partners`, port 3001):
  - Payload config through `alphaConfig` with `cookiePrefix: 'alpha-partners'`, `runJobs: false`, no admin routes and no migrations; media URLs point at the web app.
  - Every response is `Cache-Control: private, no-store` and `X-Robots-Tag: noindex, nofollow`; `robots.txt` disallows everything.
  - `/login/`: email and password form (works without JavaScript), posting to `POST /api/v1/session`. Wrong details, a locked account and a cross-site post each answer with a reason on the form. A staff or customer account cannot sign in here.
  - Sign-out: `POST /api/v1/session/sign-out` ends the Payload session (not only the cookie).
  - `/catalogue/`: products on sale in the company's market (published there, brand with live rights; the sale rule of ADR 0008), with brand, title in the user's locale, SKU, RRP incl. VAT, the company's own net price, its status (`needs approval`, `unavailable`), a "why this price" trace and stock per the company's visibility setting (exact, banded, hidden; the expected date from an open purchase order when none is in stock). Paged, with a keyword filter.
  - Header: company, tier, credit limit (owner and purchaser only, as access allows), a hold notice when on hold, and sign-out.
  - The page renders in English or Arabic (`CompanyUsers.locale`), RTL in Arabic.
  - Partner API: `GET /api/v1/catalogue` (the same rows as JSON) and `POST /api/v1/price/resolve` (lines with SKU and quantity, Zod-validated; returns the resolved lines and totals with their trace). Both read the company from the session only; anything else is 401.
- **`CompanyUsers.locale`** (`en` | `ar`, default `en`), with a migration and regenerated types.
- **`packages/payload/system/partnerCatalogue`:** `partnerCatalogue(payload, user, options)`: the rows above for the signed-in company user, or null for anyone else. Cost and pricing inputs never leave it: only the resolved outcome, the trace without the margin floor, and the stock band.
- **`packages/ui`:** `CompanyHeader` (dark band), `PartnerCatalogueTable`, `PriceTraceDrawer` (a `<details>` disclosure), each with the five stories, in the inventory, LTR and RTL snapshots.
- **i18n:** `partners.*` keys in English and draft Arabic.
- **Seed:** `seed:trade` (development and CI only): two demo companies in the UAE with users, a contract price, a price list and a promotion.
- **Tests:** integration (`partners.integration.test.ts`): catalogue rows, prices and visibility per company, no cost or rule data in the output, not on sale hidden, non-company users refused, ETA when out of stock. End to end (`apps/partners/e2e`): sign in, catalogue with own price, trace, sign out; wrong password; the second company sees its own prices; Arabic RTL.
- **Docs:** ADR 0014 (shared configuration, a separate app and cookie), runbook `partners.md`, `.env.example`.

## Acceptance criteria

- [x] A company user signs in on the partners app and sees only products on sale in their company's market, each with their own resolved price, RRP and trace; a second company sees its own different prices for the same products.
- [x] Stock is shown exact, banded or not at all per the company's setting; zero stock shows the expected date when a purchase order is open.
- [x] No response contains cost, landed cost, margin, contract or rule data beyond the company's own outcome; credit is shown only to owners and purchasers.
- [x] Staff and customer accounts cannot sign in; the APIs answer 401 without a company session; a cross-site sign-in or sign-out is refused.
- [x] Every partners response is `private, no-store` and `noindex`; `robots.txt` disallows everything.
- [x] The catalogue works without JavaScript and in Arabic RTL.
- [x] Sign-out ends the session server-side: the old cookie no longer authenticates.
