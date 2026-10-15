# Task 0018 — Leads: storefront enquiries routed to dealers with a 24-hour acceptance

Phase: P2 Dealer board. Depends on: 0008 (brand agreements), 0010 (notifications), 0013 (companies), 0014 (partners app). Spec: Dealer board rules (leads routed by `BrandAgreements.leadRouting` then territory; `acceptBy = createdAt + 24 h`; unanswered leads re-route and the event is logged), Content and data model (`Leads`), Partner API (`/leads`, accept, outcome), Jobs (`routeLead`), Components (LeadCard with acceptance timer), Business events (`lead_routed`, `lead_accepted`).

## Goal

A shopper asks for a price or a specialist from a product page, in English or Arabic, without JavaScript. The enquiry becomes a lead, and the system decides who answers it:

- the brand's agreement in the market keeps it with Alpha, or sends it to a dealer;
- dealers in the shopper's city are preferred, then those with the fewest open leads;
- the chosen dealer is emailed and has 24 hours to accept on the dealer board;
- a lead that is declined or not accepted in time goes to the next dealer, and every hop is recorded;
- when no dealer is left, Alpha's team takes it.

The shopper's contact details reach a dealer only once that dealer accepts. The dealer then records the outcome.

## Deliverables

- **`packages/core/leads`:**
  - `nextRecipient(lead, candidates, tried)`, a pure function: Alpha when the agreement routes to Alpha or no candidate is left; otherwise the untried candidate whose territory includes the lead's city, then the fewest open leads, then the lowest id.
  - `LeadService`:
    - `create`, idempotent per request key;
    - `route` (from `new` through `routing` to `offered` with `acceptBy` = now + 24 h, or `with-alpha`);
    - `accept` (only the offered company, before `acceptBy`);
    - `decline` and `expire` (the attempt is recorded, back to `new` for the next route);
    - `close` with outcome `won` (with value) or `lost`.
  - Every change is a compare-and-set, and attempts are kept in order.
  - Unit tested to 90%+.
- **`Leads` collection** (Trade group; migration; number sequence `L-AE-2026-000001`):
  - Fields: source (`request-price` | `specialist`), market, locale, brand, product, city, message, contact (name, email, phone), consent, status, routing (`alpha` | `dealer`), offered to, accept by, attempts (company, offered, accept by, result), outcome, value and staff notes.
  - Access:
    - staff read all;
    - a company user reads the leads currently offered to or accepted by their company;
    - contact fields only once their company has accepted.
  - System-written.
- **`Companies`:** `territories` (cities served) and `settings.acceptsLeads`; migration.
- **Jobs:**
  - `routeLead` (queued when a lead is created, declined or expires). It routes and notifies.
  - `rerouteExpiredLeads` (every 5 minutes). It expires offers past `acceptBy` and queues `routeLead`.
  - Both are idempotent.
- **Notifications** (outbox, ADR 0010):
  - `lead-received` to the shopper (in their language);
  - `lead-offered` to the offered company's owners and purchasers, with the product, city and deadline but no contact details.
- **Storefront:**
  - The product page gets "Request a price" (price on request) or "Ask a specialist" (priced), linking to `/{m}/{l}/enquire/?product={slug}`.
  - The enquiry page has the product and the form: name, email, phone, city, message and consent. It works without JavaScript, posting to `POST /api/v1/markets/{m}/leads` (same-origin, rate-limited per address and IP, honeypot field) and landing on a thank-you notice.
  - `noindex`; it is in robots' disallow list.
- **Partners app:**
  - `/leads` shows `LeadCard`s: product, brand, city, message, and the time left as text ("Accept by 16 Oct, 10:42 · about 23 hours left"), with Accept and Decline.
  - Accepted leads show the contact and an outcome form (won with value, or lost).
  - Partner API:
    - `GET /api/v1/leads`;
    - `POST /api/v1/leads/{number}/accept`;
    - `POST /api/v1/leads/{number}/decline`;
    - `POST /api/v1/leads/{number}/outcome`.
- **UI:** `LeadCard` (five stories).
- **Seed:** `seed:trade` marks both companies as accepting leads, with territories (Harmony: Dubai; Gulf: Abu Dhabi), and gives Sonus faber an agreement routing leads to dealers. (The demo has nothing that routes to Alpha yet.)
- **Tests:**
  - Core unit tests for routing, the state machine, expiry and races.
  - Integration (`leads.integration.test.ts`):
    - routing by agreement and territory;
    - contact hidden until accepted;
    - decline and expiry re-route, ending with Alpha;
    - only the offered company may accept;
    - the storefront endpoint (validation, rate limit, honeypot);
    - notifications queued.
  - End to end: the shopper sends an enquiry, and the routed dealer sees and accepts it on the board, then sees the contact.
- **Docs:** ADR 0018 (lead routing and privacy until acceptance), runbook `leads.md`.

## Acceptance criteria

- [x] An enquiry for a brand routed to dealers is offered to the dealer covering the shopper's city, then to the dealer with the fewest open leads; one routed to Alpha stays with Alpha.
- [x] The offered dealer is emailed and has 24 hours to accept; a declined or expired offer goes to the next dealer, and with none left, to Alpha. Every hop is recorded.
- [x] A dealer sees the shopper's contact details only after accepting, and only for its own leads.
- [x] The enquiry form works without JavaScript in English and Arabic and refuses cross-site posts, bots (honeypot) and floods (rate limit).
- [x] An accepted lead can be closed as won (with value) or lost.
