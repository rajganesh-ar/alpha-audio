# Runbook — leads

How storefront enquiries reach dealers, and what to do when one is stuck. Read ADR 0018 for the design.

## The flow

1. A shopper presses "Request a price" or "Ask a specialist" on a product page and sends the enquiry form (`/{market}/{locale}/enquire/?product=…`). They receive an acknowledgement email.
2. The `routeLead` job decides where the lead goes:
   - **with Alpha**, if the brand's agreement in the market says leads go to Alpha;
   - otherwise **offered to one company**: the one serving the shopper's city first, then the one with the fewest open leads. Only companies with "Accepts leads" ticked are candidates.
3. That company's owners and purchasers get an email (product, city, deadline; no contact details). They have **24 hours** to accept on the dealer board (Leads).
4. **Accept** shows the shopper's contact to that company. **Decline**, or no answer by the deadline, offers it to the next company. When no company is left, the lead goes to Alpha.
5. The dealer records the outcome, **won** (with value) or **lost**.

## Settings

- **Brand agreements → Lead routing** (`alpha` or `dealer`), per brand and market.
- **Companies → Settings → Accepts leads**, and **Territories** (city names as shoppers type them, for example `Dubai`, `Abu Dhabi`; case does not matter).

## Checks

- **Trade → Leads** in the admin shows every lead, its status and its **attempts** (who was offered it, when, and what happened).
- `with-alpha` leads are Alpha's to follow up; filter the list by status.
- The jobs run in the web app (`leads` queue). If leads stay `new`, check Payload jobs for `routeLead` failures in the dead-letter view.
- If offers do not expire, check `rerouteExpiredLeads` (every 5 minutes).

## Shopper complaints

- **"Nobody contacted me"**: find the lead by the shopper's email. Its attempts show who had it.
  - If a dealer accepted but did not call, follow up with that dealer.
  - If it is still offered, it will move on at its deadline. Staff can call the shopper directly.
- **"I was contacted by someone I don't know"**: the shopper consented to one partner contacting them. The accepting company is on the lead.
