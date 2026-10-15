import type { Id } from '../ledger/types'
import type { PricedLine, Totals } from './pricing'

/**
 * Checkout states (spec: Server logic → Checkout state machine). `reserving` and `confirming`
 * are short-lived locks: whoever moves an order into them owns the next step.
 */
export const ORDER_STATUSES = [
  'reserving',
  'unavailable',
  'paying',
  'confirming',
  'confirmed',
  'failed',
  'expired',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const FAILURE_REASONS = [
  'declined',
  'payment-error',
  'amount-mismatch',
  'stock-lost',
] as const
export type FailureReason = (typeof FAILURE_REASONS)[number]

export interface OrderPayment {
  provider: string
  intentId: string | null
  status: 'pending' | 'authorised' | 'captured' | 'declined' | 'failed' | null
}

export interface OrderRecord {
  id: Id
  number: string
  market: string
  status: OrderStatus
  idempotencyKey: string
  lines: PricedLine[]
  totals: Totals
  reservations: Id[]
  /** Earliest expiry of the cart holds while paying; null once the order holds stock for good. */
  holdExpiresAt: Date | null
  payment: OrderPayment
  failureReason: FailureReason | null
  /** Lines that could not be reserved (status `unavailable`). */
  unavailableSkus: string[]
}

export type NewOrder = Omit<OrderRecord, 'id'> & {
  /** Contact, address, method and locale, stored as the app shapes them; the service does not read them. */
  details: Readonly<Record<string, unknown>>
}

export type OrderPatch = Partial<
  Pick<
    OrderRecord,
    'reservations' | 'holdExpiresAt' | 'payment' | 'failureReason' | 'unavailableSkus'
  >
>

/** Persistence for the checkout. The Postgres store lives in `@alpha/payload` (system). */
export interface CheckoutStore {
  /** `AE-2026-000123`, from a database sequence. */
  nextOrderNumber(market: string, now: Date): Promise<string>
  findByIdempotencyKey(key: string): Promise<OrderRecord | null>
  findByIntent(provider: string, intentId: string): Promise<OrderRecord | null>
  /** Inserts, or returns the order that already holds the idempotency key (concurrent submit). */
  insertOrder(order: NewOrder): Promise<{ order: OrderRecord; created: boolean }>
  /** Compare-and-set: moves the order to `to` only from one of `from`; true when this call won. */
  transition(
    id: Id,
    from: readonly OrderStatus[],
    to: OrderStatus,
    patch?: OrderPatch,
  ): Promise<boolean>
  update(id: Id, patch: OrderPatch): Promise<void>
  /** Records an inbound event; false when (provider, eventId) was seen before. */
  recordEvent(provider: string, eventId: string, payloadHash: string): Promise<boolean>
  /** Orders still paying whose holds expired at or before `now`. */
  listExpired(now: Date, limit: number): Promise<OrderRecord[]>
}

export type StartResult =
  | { ok: true; order: OrderRecord; redirectUrl: string }
  | { ok: false; reason: 'bag-invalid'; order?: undefined }
  | { ok: false; reason: 'unavailable'; order: OrderRecord; skus: string[] }
  | { ok: false; reason: 'payment-error'; order: OrderRecord }
  /** Another request with the same key is still reserving or confirming. */
  | { ok: false; reason: 'in-progress'; order: OrderRecord }
  | { ok: false; reason: 'already-closed'; order: OrderRecord }

export type EventOutcome =
  | 'duplicate'
  | 'unknown-intent'
  | 'confirmed'
  | 'already-confirmed'
  | 'failed'
  | 'mismatch'
  | 'stock-lost'
  | 'ignored'
