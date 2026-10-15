# Runbook — trade pricing

How a dealer's price is worked out, where commercial staff set it, and what to check when a dealer questions one. Read ADR 0013 for the design.

## Where prices come from (first match wins)

1. **Contract price** (Trade → Contract prices): a net price for one company and SKU, optionally dated.
2. **Project price**: arrives with project registrations.
3. **Price list** (Trade → Price lists): the company's own list, or else its buyer group's. It must be published, in the company's market, and in date.
4. **Dealer list**: RRP excluding VAT × the channel factor (Trade → Pricing settings: dealer 70%, integrator 75%, retailer 80% by default). With no RRP, it is landed cost ÷ (1 − target margin).

A dealer-list price then takes:

- the buyer group's discount (a brand row beats a category row, which beats an all-products row);
- the best volume break for the quantity;
- a promotion.

A promotion marked **stackable** also applies to contract and price-list prices.

## The margin floor

A price below landed cost ÷ (1 − margin floor) is marked **needs approval**. For other currencies, landed cost is converted at the FX rate in Pricing settings. With no rate for a currency, the floor is not checked: set rates for every trade market. Approval workflow (special price requests) arrives with dealer orders.

## A dealer questions a price

Every resolved price carries a trace: each rule, whether it was considered, whether it matched, and its value. The dealer board shows it in the "why this price" drawer; staff see the same trace on the order or quote line. Check, in order:

- **Contract**: is there a live contract for this SKU (dates are inclusive of start, exclusive of end)?
- **Price list**: is the list published, in the right market, in date, and attached to the company or its group?
- **Channel and group**: is the company's channel right, and which group is it in?
- **Product**: is the product on sale in the company's market (published and the brand has live rights)? If not, the line is **unavailable**.

## MAP

Products → Markets → **MAP excl. VAT**: the minimum advertised price agreed with the brand. Saving an RRP below MAP + VAT is refused, and the error gives the lowest allowed RRP.

## Never

- Never send a dealer a screenshot of the admin: rules, landed cost and other companies' terms are on those screens.
- Never give a company user a staff account to "check prices". Use their own login; it shows exactly what they see.
