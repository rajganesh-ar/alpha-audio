import type { Id } from '../ledger/types'
import type { Money } from '../money'
import type { FailureReason, OrderPayment, OrderStatus } from '../checkout/types'
import type { PricedLine, Totals } from '../checkout/pricing'

/**
 * Fulfilment of a confirmed order (docs/tasks/0010), alongside the checkout status. The `-ing`
 * states are claims: whoever moves an order into one owns that step, so two actions (a ship
 * and a cancel) can never interleave; the same action may resume an interrupted claim.
 */
export const FULFILMENT_STATUSES = [
  'awaiting',
  'picking',
  'picked',
  'shipping',
  'shipped',
  'delivering',
  'delivered',
  'cancelling',
  'cancelled',
] as const
export type FulfilmentStatus = (typeof FULFILMENT_STATUSES)[number]

export const REFUND_STATUSES = ['none', 'pending', 'refunded', 'manual', 'failed'] as const
export type RefundStatus = (typeof REFUND_STATUSES)[number]

export const NOTIFICATION_TEMPLATES = [
  'order-confirmed',
  'order-shipped',
  'order-delivered',
  'order-cancelled',
] as const
export type NotificationTemplate = (typeof NOTIFICATION_TEMPLATES)[number]

export interface OrderRefund {
  status: RefundStatus
  amount: Money | null
  reference: string | null
  error: string | null
}

export interface ShipmentRef {
  id: Id
  number: string
}

export interface FulfilmentOrder {
  id: Id
  number: string
  market: string
  status: OrderStatus
  failureReason: FailureReason | null
  fulfilment: FulfilmentStatus
  lines: PricedLine[]
  totals: Totals
  /** The order's holds, one per line (order holds since confirmation). */
  reservations: Id[]
  payment: OrderPayment
  refund: OrderRefund
  shipment: ShipmentRef | null
  cancelReason: string | null
}

export interface ShipmentInput {
  courier: string
  trackingNumber: string
  trackingUrl?: string | null | undefined
}

export interface FulfilmentPatch {
  cancelReason?: string
  shipment?: ShipmentRef
}

/** Persistence for fulfilment. The Postgres store lives in `@alpha/payload` (system). */
export interface FulfilmentStore {
  findByNumber(number: string): Promise<FulfilmentOrder | null>
  /** Compare-and-set on the fulfilment status; true when this call won. */
  transition(
    id: Id,
    from: readonly FulfilmentStatus[],
    to: FulfilmentStatus,
    patch?: FulfilmentPatch,
  ): Promise<boolean>
  /** The order's shipment, created once (a retried ship returns the same one). */
  ensureShipment(order: FulfilmentOrder, input: ShipmentInput, now: Date): Promise<ShipmentRef>
  markShipmentDelivered(shipment: ShipmentRef, now: Date): Promise<void>
  /** Claims the refund: `none` or `failed` → `pending`; true when this call won. */
  claimRefund(id: Id): Promise<boolean>
  setRefund(id: Id, refund: OrderRefund): Promise<void>
}

/** Queues a customer notification once per order and template (an outbox). */
export type Notify = (order: FulfilmentOrder, template: NotificationTemplate) => Promise<void>

export type FulfilmentRefusal =
  | 'not-found'
  | 'not-confirmed'
  | 'wrong-status'
  | 'hold-missing'
  | 'invalid-shipment'
  | 'not-refundable'

export type FulfilmentResult =
  | { ok: true; order: FulfilmentOrder; changed: boolean }
  | { ok: false; reason: FulfilmentRefusal; order?: FulfilmentOrder | undefined; detail?: string }
