# ADR 0014 — The dealer board is its own app, on one shared Payload configuration

- Status: Accepted
- Date: 2026-10-15
- Task: `docs/tasks/0014-partners-catalogue.md`

## Context

The spec puts the dealer board on its own domain (`partners.alphaaudios.com`), "never under the public tree, so its auth and no-cache rules cannot leak", and lists `apps/partners` as a separate deployment that shares `packages/*`. The board reads the same database, collections, access rules and services as the web app: the price engine, the ledger, brand rights. Until now the Payload configuration lived in `apps/web`, and packages may not import apps.

## Decision

1. **One configuration, built by a function.**
   - `alphaConfig(options)` in `packages/payload` holds every collection, global, job, the editor, the database adapter, storage and email. `Users` and `Media` move into the package with the rest.
   - Each app passes only what differs:
     - the admin and its custom views (web only);
     - the migrations run at start-up (web only; the board never migrates);
     - whether it works the job queues (web only, so each job runs once; the board may queue jobs);
     - its auth cookie prefix;
     - where its generated types go.
   - Both apps therefore generate identical `payload-types.ts`; CI regenerates both and fails on a diff.
2. **A separate app and cookie.**
   - `apps/partners` is its own Next.js app (port 3001 locally), deployed separately on the partners domain. It mounts no Payload admin or REST routes; it talks to Payload through the Local API only.
   - Its session cookie is `alpha-partners-token` (cookie prefix `alpha-partners`), host-only on the partners domain, httpOnly, SameSite=Lax and Secure on https. Storefront and admin cookies are never sent to it and its cookie is never sent to them.
   - `csrf` lists the partners origin, so Payload accepts its cookie only from a same-origin request (Origin or Sec-Fetch-Site).
3. **Sign-in is Payload's auth, for company users only.**
   - `signInPartner` calls Payload's login for `company-users` (hashed passwords, five failures lock the account for 15 minutes, 24-hour token). A staff or customer account cannot sign in on the board.
   - Payload stores a session id in the token, and `signOutPartner` removes it, so a copied cookie stops working after sign-out.
   - Payload reports a locked account and a wrong password with the same status; the lock stamp tells them apart, so the dealer gets the right message.
4. **Everything is private.**
   - Every board response carries `Cache-Control: private, no-store` and `X-Robots-Tag: noindex, nofollow` (set for all paths in `next.config.mjs`, and on API responses). `robots.txt` disallows everything.
5. **The catalogue is a system service.**
   - `partnerCatalogue(payload, user, options)` reads products as the user (cost stays behind its field access) and applies the storefront's sale rule (published in the market, brand with live rights; ADR 0008).
   - It prices through `loadPricingData` and `resolvePrices` (ADR 0013) and words stock through `stockBand` with the company's visibility, adding the open purchase order date when none is in stock.
   - Only outcomes leave: the price, its basis and a trace without the internal steps (project slot, margin floor). The service and the sign-in functions are integration tested on the web app's configuration, which is the same configuration.

## Consequences

- A collection, access or hook change lands in both apps at once. Each app must be redeployed for it, and the web app must migrate first.
- Company users can still authenticate against the web app's Payload REST API (it mounts every collection). Access is identical there, so nothing leaks; the board is simply the supported surface.
- API clients that are not browsers send `Authorization: JWT <token>` until partner API keys arrive with the dealer API task.
- Growing the board (orders, quotes, projects, leads) adds pages and handlers to `apps/partners` and services to `packages`, never a second configuration.
