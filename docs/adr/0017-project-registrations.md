# ADR 0017 — Project prices come from staff-approved registrations

- Status: Accepted
- Date: 2026-10-15
- Task: `docs/tasks/0017-project-registrations.md`

## Context

Dealers pursue projects (a villa, a hotel, an office) against competitors and ask Alpha for a sharper price for that job. The price engine has reserved a `project` slot since ADR 0013: contract → project → price list → dealer list. A project price must apply only to the dealer who registered the project, only for orders or quotes for that project, and only while it stands.

## Decision

1. **A `ProjectRegistrations` collection.** The dealer registers end customer, site, expected close and products with quantities.
   - Statuses: `submitted` → `reviewing` (claim) → `approved` | `rejected`, and `withdrawn` by the dealer. An approved project past its validity reads as `expired`.
   - Every change is a compare-and-set through `ProjectService`; staff decide on `/ops/projects/`.
2. **Approval sets a net project price per line** (any subset of the lines) and a validity of 1 to 365 days. Prices are typed in the market currency and stored in minor units.
3. **The engine's `project` slot takes `PricingData.projectPrices`.**
   - The slot comes after contracts and before price lists, and a project base takes no list adjustments. A stackable promotion and the margin floor still apply, so a below-floor project price still needs Alpha's approval when ordered.
   - The trace shows "Project price"; the board now shows that step, which ADR 0014 hid while it was empty.
4. **The project is checked on the server, not trusted from the client.**
   - Orders, quotes, previews and `/price/resolve` take a project number, but only `projectForSession` turns it into prices: the user's own company's project, in the company's market, approved and in date.
   - Anything else is refused with `project-unavailable`. A preview shows normal prices with a notice.
5. **Orders and quotes record the project number.** A quote ordered later keeps its locked project prices (ADR 0016) and passes the project on to the order.

## Consequences

- There is no cap on cumulative quantities across a project's orders yet. The registered quantities guide the review; allocations (stock reserved per project, P4) will add a cap.
- Two dealers may register the same end customer; deciding which one Alpha supports is a commercial judgement made at review. Rejection notes tell the dealer why.
