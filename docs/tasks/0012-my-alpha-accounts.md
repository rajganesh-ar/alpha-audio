# Task 0012 — My Alpha: customer sign-in and order history

Phase: P2 Storefront. Depends on: 0009 (orders), 0010 (order page, notification outbox). Spec: Security → Identity and access (Customers: verified mobile or email magic link; own records only); Page specifications (My Alpha: orders and tracking); Content and data model (Customers); APIs (`/account/*`, session cookie, CSRF token).

## Goal

A customer signs in to My Alpha with a one-time link emailed to them (no password) and sees the orders they placed with that address, with tracking. Mobile OTP needs an SMS or WhatsApp provider, which is not chosen yet, so email links come first. They are equally valid under the spec.

## Deliverables

- **Collections** (migration included):
  - `Customers`: Payload auth with only a custom session strategy and no local passwords. Fields: email (unique), name, phone, market, locale, last sign-in, marketing consent. Staff read and correct; a customer reads only their own record.
  - `CustomerSessions`: token hash, customer, expiry, revoked at. System only.
  - `SignInLinks`: token hash, email, market, locale, IP hash, expiry, used at. System only.
  - The notification outbox gains the `sign-in` template, an optional customer, and an encrypted `secret` that is cleared once sent.
- **`packages/core/account`:** link lifetime 15 minutes, single use; sessions last 30 days; limits of 5 links per address and 20 per network per hour; email normalisation. Unit tested.
- **`packages/payload/system/accounts`:**
  - `requestSignIn`: rate limited; the same answer whether or not an account exists; the link is sealed with AES-GCM in the outbox.
  - `completeSignIn`: compare-and-set use; creates the customer on first sign-in; issues a session.
  - `customerFromSession`, `endSession`, and per-session CSRF tokens.
- **Access:**
  - Orders: a customer reads orders whose contact email is theirs.
  - Shipments: a customer reads their own orders' shipments.
  - Staff-only fields stay hidden from customers: notes, cancel reason, refund reference and error, payment intent, keys and token hashes.
- **Handlers** under `/api/v1/markets/{m}/account/`: `sign-in`, `verify` and `sign-out` (CSRF). Same-origin, `303` answers. The session cookie is `alpha_session`: httpOnly, SameSite=Lax, Secure on https.
- **Pages** (dynamic, `noindex`, no JavaScript needed):
  - `/account/` (sign-in form and messages).
  - `/account/verify/?token=`: a button, because mail scanners open links.
  - `/account/orders/` and `/account/orders/{number}/`, sharing the order view with the token page.
  - The header gets an Account action, and checkout pre-fills a signed-in customer's details.
- **UI:** `AccountTabs`, with five stories, axe, and LTR/RTL snapshots.
- **E2E:** sign in from the emailed link (Mailpit) and see the order, in `ae/en` and `ae/ar`. CI runs Mailpit as a service.

## Acceptance criteria

- [x] Asking for a link always answers "check your email". The link signs in once, within 15 minutes; a used, expired or forged link is refused with the reason. Requests are rate limited per address and per network.
- [x] Neither the link token nor the session token is stored in the clear; the emailed link leaves the outbox once sent.
- [x] A signed-in customer sees only orders placed with their email, and their shipments, never another customer's and never staff fields. Anonymous visitors read no customers, sessions, links or orders.
- [x] Signing out needs the session's CSRF token, ends the session and clears the cookie.
- [x] Playwright: buy, sign in from the emailed link, see the order and its progress, sign out, in `ae/en` and `ae/ar`. `AccountTabs` passes the five-story check, axe and visual snapshots.
