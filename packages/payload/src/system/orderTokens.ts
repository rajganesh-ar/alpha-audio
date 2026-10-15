import { createHmac } from 'node:crypto'
import type { Payload } from 'payload'

/**
 * The token in an order's links (confirmation page, emails). Derived from the order's
 * idempotency key with the instance secret, so the checkout, a resubmit and the notification job
 * all compute the same token without storing it; orders keep only its SHA-256 (docs/tasks/0009).
 */
export function orderAccessToken(payload: Pick<Payload, 'secret'>, idempotencyKey: string): string {
  return createHmac('sha256', payload.secret)
    .update(`order-access\n${idempotencyKey}`)
    .digest('base64url')
}
