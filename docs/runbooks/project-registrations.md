# Runbook — project registrations

How dealers register projects, how staff approve them with project prices, and what dealers see. Read ADR 0017 for the design.

## Dealer side

- **Registering.** Projects → Register a project: name, end customer, city, expected close (today or later), and products with quantities. Only owners and purchasers can register; SKUs must be in the catalogue.
- **While it waits.** The project shows "Waiting for Alpha" until a decision.
- **Once approved.** The project page lists each product's project price and "Prices valid until". "Order for this project" opens the order review priced for the project; the dealer can also save it as a quote.
- **Withdrawing.** A dealer can withdraw a submitted or approved project.

## Staff side: reviewing on `/ops/projects/`

1. Open the registration, check the end customer and site, and look for other dealers' registrations for the same job.
2. Enter a **project price (net)** in the market currency for each product Alpha supports (for example `4500.00`). Leave a product blank to keep normal pricing for it.
3. Set **valid for (days)** (default 90) and a **note for the dealer**, which they see on the project.
4. Press **Approve with these prices**, or **Reject** with the reason in the note.

What the prices do:

- A contract price for the same product still comes first.
- A project price below the margin floor is allowed, but each order at that price waits for Alpha's approval on `/ops/trade-orders/`.

## When dealers ask

- **"The project price is not applied"**: the order must be placed from the project (the review says "Priced for project …"). The project must be approved and in date. A contract price for the product wins over the project price.
- **"That project cannot be used"**: it was rejected, withdrawn or expired, or it belongs to another company.
