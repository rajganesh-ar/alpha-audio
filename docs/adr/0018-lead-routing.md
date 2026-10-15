# ADR 0018 — Leads are offered to one dealer at a time, and stay anonymous until accepted

- Status: Accepted
- Date: 2026-10-15
- Task: `docs/tasks/0018-lead-routing.md`

## Context

Shoppers ask about products they cannot simply buy (price on request) or want advice on. The spec routes those leads by the brand's agreement (`BrandAgreements.leadRouting`: Alpha or dealer), then by territory. A dealer has 24 hours to accept, and unanswered leads re-route with the event logged. A shopper's contact details are personal data: they should reach the one dealer who takes the lead, not every dealer it was offered to.

## Decision

1. **A `Leads` collection with a compare-and-set state machine** (`LeadService`): `new` → `routing` (claim) → `offered` (to one company, with `acceptBy` = now + 24 h) or `with-alpha`; `offered` → `accepted` → `closed` (won with value, or lost); `offered` → `new` on decline or expiry.
   - Every offer is an attempt (company, offered, deadline, result) kept in order and visible to staff.
2. **Routing is a pure function** (`nextRecipient`).
   - Alpha when the brand's live agreement in the market routes to Alpha, or no untried candidate is left.
   - Otherwise, among companies in the market that accept leads, the untried one whose territories include the lead's city, then the fewest open leads, then the lowest id.
   - Territories are plain city names on the company, staff-maintained.
3. **Privacy until acceptance.**
   - Read access shows a company only the leads currently offered to or accepted by it.
   - The contact group's field access opens only for the accepting company, once the lead is accepted.
   - The offer email to the dealer carries the product, city and deadline, never the contact. Declined and expired offers vanish from the dealer's board.
4. **Jobs:**
   - `routeLead` is queued on create, decline and expiry; it is idempotent because only one run can move the lead out of `new`.
   - `rerouteExpiredLeads` runs every 5 minutes on its own `leads` queue, worked by the web app.
   - Routing, acceptance and expiry are logged (`lead_routed`, `lead_accepted`, `lead_offer_expired`) for the event pipeline.
5. **The storefront enquiry is a plain form**, same-origin checked:
   - a honeypot answers "sent" without recording anything;
   - a rate limit of 5 an hour per address and 20 per IP (the IP is stored as a keyed hash only);
   - a form key makes a double submit one lead;
   - the shopper consents to being contacted by one partner.
     The page is `noindex` and disallowed in robots.

## Consequences

- Dealer brand authorisation is not modelled: any company that accepts leads in the market can receive any dealer-routed brand's lead. Rights per dealer and brand can refine `candidates` later without changing the service.
- Alpha's own handling of `with-alpha` leads is the admin list for now. A lead router view (spec: LeadRouter) can come with CRM handoff.
- Every hop takes up to 24 hours, so a lead offered to many dealers can take days to reach Alpha. Staff can intervene from the admin.
