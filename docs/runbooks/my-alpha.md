# Runbook — My Alpha accounts

How customers sign in and what to do when they can't. Read ADR 0012 for the design.

## How sign-in works

1. The customer enters their email at `/{m}/{l}/account/`. We email a sign-in link. The page always says "check your email", whether or not an account exists.
2. The link opens a page with a **Sign in** button. Pressing it signs them in on that device for 30 days. The first sign-in creates their customer record.
3. **My Alpha → Orders** lists the orders placed in that market with that email address, with tracking.

A link works once, for 15 minutes. An address can ask for 5 links an hour, and one network for 20.

## Customer says…

| Report                          | Why                                                               | Do                                                                                                                                                                      |
| ------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "The email never came"          | Spam folder, a typo, or the send failed                           | Check **Sales → Notifications** for a `sign-in` row to that address: `sent`, `queued` (being retried) or `failed` (see the order-fulfilment runbook for failed emails). |
| "The link says it was used"     | They pressed Sign in already, perhaps on another device           | Ask them to request a new link. Opening the page never uses a link; only the button does.                                                                               |
| "Too many links requested"      | Five links in the last hour for that address                      | Wait an hour, or check for a script hammering the form.                                                                                                                 |
| "I can't see my order"          | The order was placed with a different email, or in another market | Search **Orders** by the customer's emails; orders show in the market they were placed in.                                                                              |
| "Change my email"               | Account email is the sign-in identity                             | Edit the customer in **Customers → Customers** after verifying the request out of band.                                                                                 |
| "Delete my data" (PDPL request) | Right to erasure                                                  | Handled in the admin within 30 days (spec: data protection); orders are kept for the statutory period.                                                                  |

## Sessions

- A session is the `alpha_session` cookie, revocable at any time. To sign a customer out everywhere, set **revoked at** on their sessions (system collection; ask engineering for now).
- Sign-out requires the page's CSRF token, so a link on another site can't sign anyone out.
