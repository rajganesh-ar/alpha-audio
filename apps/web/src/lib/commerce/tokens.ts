import { createHash, createHmac, randomBytes } from 'node:crypto'
import { loadEnv } from '@alpha/config/env'
import type { PricedBag } from '@alpha/core'

/** A fresh key for one rendering of the checkout form (hidden field). */
export const newFormKey = (): string => randomBytes(18).toString('base64url')
export const FORM_KEY = /^[A-Za-z0-9_-]{16,64}$/

/**
 * The checkout's idempotency key: the cart, the form rendering and the bag being paid for. A
 * double click or a back-and-resubmit of the same form for the same bag is the same order; a
 * changed bag is a different one, so a shopper is never charged for a bag they no longer see.
 */
export function idempotencyKey(cartId: number, formKey: string, bag: PricedBag): string {
  const fingerprint = bag.lines
    .map((l) => `${l.sku}:${l.qty}:${l.unitPrice.amount}`)
    .sort()
    .join('|')
  return createHash('sha256')
    .update(`${cartId}\n${formKey}\n${bag.totals.total.currency}\n${fingerprint}`)
    .digest('hex')
}

/**
 * The token in the order's confirmation link. Derived from the idempotency key with a server
 * secret, so a resubmitted checkout links to the same order; only its hash is stored.
 */
export function orderAccessToken(
  key: string,
  source: Record<string, string | undefined> = process.env,
): string {
  return createHmac('sha256', loadEnv(source).PAYLOAD_SECRET)
    .update(`order-access\n${key}`)
    .digest('base64url')
}
