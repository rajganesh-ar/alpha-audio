# Runbook — dealer quotes

What a dealer quote keeps, how long, and what to do when one misbehaves. Read ADR 0016 for the design.

## What a quote does

- **Saving one.** From the order review, a dealer (owner or purchaser) presses "Save as quote", with an optional reference.
- **What it locks.** The quote keeps, line by line, the company's net price, the price basis and "why this price", plus the FX rates of that moment. They hold until **valid until**: now plus Trade → Pricing settings → **Quote validity (days)**, 7 by default.
- **Stock.** Each line holds stock if it can (ledger reservation of type `quote`, expiring at the validity). A line shown "Not held" is reserved only when the quote is ordered.
- **Accounts on hold.** Quoting is allowed on hold; ordering is not.
- **Ordering it.** "Order this quote" places a dealer order at the quoted prices, moving the held stock to the order. The order's rules, credit and approvals apply as usual (see the dealer orders runbook). If the order is refused, the quote stays open.
- **Withdrawing it** releases the stock.

## Questions dealers ask

- **"The order price is not today's price"**: it is the quoted price, locked until the quote expired or was ordered. That is intended.
- **"My quote expired"**: open quotes stop holding stock at their validity. The quote page offers "Review at today's prices" with the same lines.
- **"Stock was there when I quoted"**: unheld lines, or holds that lapsed, are reserved again only when ordering. If the stock has gone, nothing is ordered and the quote stays open.

## When something is stuck

- **A quote shows "Being ordered" for more than a minute**: an order attempt crashed half-way. Check Trade → Dealer orders for an order with the quote's reference.
  - If one exists, set the quote to `ordered` with that order number.
  - If not, set it back to `open`.
  - Either way, ask engineering for the one-row update and note it in the incident.
