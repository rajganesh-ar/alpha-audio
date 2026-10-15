import type { Money } from '../money'

/** What the checkout needs from any payment provider (gateway, BNPL). */
export const PAYMENT_EVENT_TYPES = ['authorised', 'captured', 'declined', 'failed'] as const
export type PaymentEventType = (typeof PAYMENT_EVENT_TYPES)[number]

export interface PaymentRequest {
  orderNumber: string
  amount: Money
  /** A rail from the Markets record, e.g. `card`. */
  method: string
  /** Where the provider sends the shopper back. */
  returnUrl: string
  /** Same key, same intent: a retried checkout never creates a second payment. */
  idempotencyKey: string
  locale: string
}

export interface PaymentIntent {
  provider: string
  intentId: string
  /** Hosted payment page. */
  redirectUrl: string
}

export interface PaymentEvent {
  provider: string
  /** Unique per provider; replays carry the same id. */
  eventId: string
  intentId: string
  type: PaymentEventType
  /** Minor units. */
  amount: bigint
  currency: string
}

export interface RefundRequest {
  intentId: string
  amount: Money
  /** Same key, same refund: a retried refund is never paid twice. */
  idempotencyKey: string
  reason?: string | undefined
}

export interface PaymentProvider {
  readonly id: string
  /** Rails this provider can take (intersected with the market's rails). */
  readonly methods: readonly string[]
  createPayment(request: PaymentRequest): Promise<PaymentIntent>
  /** Verifies the signature and parses the event; null when it is not authentic or not understood. */
  parseWebhook(
    rawBody: string,
    headers: Readonly<Record<string, string | undefined>>,
  ): PaymentEvent | null
  /**
   * Refunds a captured payment and returns the provider's refund reference. Absent when the
   * provider cannot refund through its API; staff then refund by hand (docs/tasks/0010).
   */
  refund?(request: RefundRequest): Promise<{ refundId: string }>
}
