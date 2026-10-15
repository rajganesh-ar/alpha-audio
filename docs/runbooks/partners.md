# Runbook — dealer board (partners app)

The dealer board is `apps/partners`, served on `partners.alphaaudios.com` (port 3001 locally). It shares the database and every collection with the web app; read ADR 0014 for the design and the trade pricing runbook for how prices are worked out.

## Running it locally

1. Start the web app's services and seed as usual (`pnpm dev`, or `migrate` and the `seed:*` scripts in `apps/web`).
2. Seed the demo companies: `pnpm --filter @alpha/web seed:trade` (development and CI only).
3. Start the board: `pnpm --filter @alpha/partners dev`, then open http://localhost:3001.
4. Sign in with password `partners-demo-123` as:
   - `owner@harmony.example`: Harmony Systems LLC, dealer, gold, contract price on the MCINTOSH-MA352, exact stock;
   - `arabic@harmony.example`: the same company, in Arabic;
   - `viewer@harmony.example`: a viewer (no credit line);
   - `owner@gulf-integrators.example`: Gulf Integrators FZE, integrator, buyer group with a McIntosh discount and a price list, banded stock.

`apps/partners/.env` holds the same variables as `apps/web/.env`; `NEXT_PUBLIC_SERVER_URL` is the web app (media), `PARTNERS_SERVER_URL` the board itself.

## Giving a dealer access

1. In the admin, Trade → Companies: the company exists with its market, channel, tier and settings (stock visibility).
2. Trade → Company users → Create: email, a temporary password, company, role and language.
   - `owner` and `purchaser` see the credit limit and hold; `viewer` and `installer` see the catalogue only.
3. Send the dealer the board's address and the temporary password by a separate channel. There is no self-service password reset yet; staff set a new one in the same screen.

## A dealer cannot sign in

- **"Too many attempts…"**: five wrong passwords lock the account for 15 minutes. Wait, or clear the lock in the admin (Company users → the user → Unlock).
- **"That email and password do not match"**: check the address in Company users. Staff and customer accounts never work on the board.
- **"This sign-in came from another site"**: the form was posted from a different origin (a bookmarked form on another host, a proxy rewriting `Origin`). Check that `PARTNERS_SERVER_URL` is the public origin and that the proxy forwards `Host`.
- Signed in but bounced back to sign-in: the cookie is refused. In production the board must be served over https (the cookie is Secure); behind a proxy, `Origin` must match `PARTNERS_SERVER_URL` or the browser's `Sec-Fetch-Site` must reach the app.

## A dealer questions what they see

- **A product is missing**: it is not on sale in the company's market. Check that it is published there and that its brand has a live agreement (Brand agreements); the board uses the storefront's rule.
- **A price**: open "Why this price" on the row, then follow the trade pricing runbook. "Needs approval" means the price is below the margin floor; ordering it will need approval (dealer orders task).
- **Stock shows a band or nothing**: the company's stock visibility setting (Companies → Settings). Out of stock shows the earliest open purchase order date.

## Checks after a deploy

- `curl -sI https://partners.alphaaudios.com/login` shows `Cache-Control: private, no-store` and `X-Robots-Tag: noindex, nofollow`.
- `https://partners.alphaaudios.com/robots.txt` says `Disallow: /`.
- `curl -s -o /dev/null -w '%{http_code}' https://partners.alphaaudios.com/api/v1/catalogue` is `401`.
- Deploy the web app (which migrates) before the board whenever a release changes collections.
