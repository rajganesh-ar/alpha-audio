# ADR 0012 — Customers sign in with an emailed one-time link

- Status: Accepted
- Date: 2026-10-15
- Task: `docs/tasks/0012-my-alpha-accounts.md`

## Context

My Alpha needs customer identity. The spec allows a verified mobile (OTP over WhatsApp or SMS) or an email magic link, with passkeys offered later. No SMS or WhatsApp provider is chosen yet, and the order emails already prove we can reach customers by email. Customer identity must never reach the admin. The buyer context must come from the session (CLAUDE.md rule 3), and access functions must do the scoping.

## Decision

1. **Payload auth, one strategy, no passwords.**
   - `Customers` is an auth collection with `disableLocalStrategy` and a custom `customer-session` strategy, so `req.user` (`collection: 'customers'`) reaches every access function.
   - The admin stays `admin.user: users`.
2. **Links: random, hashed, short-lived, single use.**
   - A link carries a 256-bit token, and `SignInLinks` stores only its SHA-256.
   - It lasts 15 minutes and is used once (compare-and-set on `usedAt`).
   - Limits: 5 per address and 20 per network per hour. The network is an HMAC of the IP under the instance secret, never the address itself.
   - Requests always answer "check your email", so the form cannot tell anyone whether an address has an account.
3. **The link travels through the notification outbox sealed.**
   - It is encrypted with AES-256-GCM under a key derived from the instance secret, and the ciphertext is cleared once the email is sent.
   - The request handler runs the job straight away (`after`), and the queue retries if that fails.
4. **The landing page does not sign in; a button does.** Mail scanners and previews open links, so the token is posted from a button. The page sets `Referrer-Policy: same-origin`, so the token never leaves the site, and same-origin form posts still carry `Origin` for the CSRF check.
5. **Sessions:**
   - The httpOnly `alpha_session` cookie holds a random token; `CustomerSessions` stores its hash.
   - Sessions last 30 days and can be revoked; sign-out revokes.
   - State-changing session forms (sign-out) carry a per-session CSRF token (an HMAC of the session) on top of the Origin and `Sec-Fetch-Site` check every POST has.
6. **Ownership is the verified email.**
   - `staffOrOwnOrders` and `staffOrOwnShipments` scope a customer to orders whose contact email is theirs; they proved it by signing in with a link sent there.
   - Field access hides staff wording and payment internals from customers.

## Consequences

- An order placed with someone else's email shows in that person's account, not the buyer's. This exposes nothing of the account owner, and it is the price of guest checkout. Linking by verified mobile replaces it when OTP arrives.
- Changing the email on an account is a support task for now (staff edit `Customers`).
- Passkeys and mobile OTP can be added as further strategies on the same collection without changing access.
