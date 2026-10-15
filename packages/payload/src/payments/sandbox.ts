import { createHmac, timingSafeEqual } from 'node:crypto'
import {
  PAYMENT_EVENT_TYPES,
  type PaymentEvent,
  type PaymentEventType,
  type PaymentIntent,
  type PaymentProvider,
  type PaymentRequest,
  type RefundRequest,
  type Money,
} from '@alpha/core'

export const SANDBOX_SIGNATURE_HEADER = 'x-sandbox-signature'

/**
 * Test-mode payment provider (docs/tasks/0009), server-side (node:crypto) so the pure port in
 * `@alpha/core/payments` stays importable from browser bundles: a hosted page in this app plays the gateway and
 * signs its events with HMAC-SHA256, the same shape real gateways use. Never a production rail.
 */
export class SandboxPaymentProvider implements PaymentProvider {
  readonly id = 'sandbox'
  readonly methods = ['card'] as const

  constructor(
    private readonly secret: string,
    /** Builds the hosted page URL for an intent, e.g. `/ae/en/checkout/sandbox/{intent}/`. */
    private readonly pageFor: (intentId: string, query: string) => string,
  ) {
    if (secret.length < 32)
      throw new Error('SandboxPaymentProvider needs a secret of at least 32 characters')
  }

  private sign(value: string): string {
    return createHmac('sha256', this.secret).update(value).digest('hex')
  }

  /** Deterministic on the idempotency key, so a retried checkout returns the same intent. */
  async createPayment(request: PaymentRequest): Promise<PaymentIntent> {
    const intentId = `sbx_${this.sign(`${request.orderNumber}:${request.idempotencyKey}`).slice(0, 24)}`
    const fields = new URLSearchParams({
      order: request.orderNumber,
      amount: request.amount.amount.toString(),
      currency: request.amount.currency,
      decimals: String(request.amount.decimals),
      return: request.returnUrl,
    })
    fields.set('sig', this.sign(`${intentId}?${fields.toString()}`))
    return { provider: this.id, intentId, redirectUrl: this.pageFor(intentId, fields.toString()) }
  }

  /** Refunds at once; the same idempotency key always yields the same refund reference. */
  async refund(request: RefundRequest): Promise<{ refundId: string }> {
    if (!request.intentId.startsWith('sbx_'))
      throw new Error(`Unknown sandbox intent ${request.intentId}`)
    return {
      refundId: `rf_${this.sign(`refund:${request.intentId}:${request.idempotencyKey}`).slice(0, 24)}`,
    }
  }

  /** The hosted page's view of an intent, if its link is authentic. */
  readIntent(
    intentId: string,
    query: URLSearchParams,
  ): { orderNumber: string; amount: Money; returnUrl: string } | null {
    const sig = query.get('sig') ?? ''
    const unsigned = new URLSearchParams(query)
    unsigned.delete('sig')
    if (!this.same(sig, this.sign(`${intentId}?${unsigned.toString()}`))) return null
    const amount = query.get('amount') ?? ''
    const decimals = Number(query.get('decimals'))
    if (!/^\d+$/.test(amount) || ![0, 1, 2, 3].includes(decimals)) return null
    return {
      orderNumber: query.get('order') ?? '',
      amount: {
        amount: BigInt(amount),
        currency: (query.get('currency') ?? '') as Money['currency'],
        decimals: decimals as Money['decimals'],
      },
      returnUrl: query.get('return') ?? '',
    }
  }

  /** What the hosted page posts back: a signed event, as a gateway would send to the webhook. */
  event(
    intentId: string,
    type: PaymentEventType,
    amount: Money,
    eventId: string,
  ): { body: string; signature: string } {
    const body = JSON.stringify({
      id: eventId,
      intent: intentId,
      type,
      amount: amount.amount.toString(),
      currency: amount.currency,
    })
    return { body, signature: this.sign(body) }
  }

  parseWebhook(
    rawBody: string,
    headers: Readonly<Record<string, string | undefined>>,
  ): PaymentEvent | null {
    if (!this.same(headers[SANDBOX_SIGNATURE_HEADER] ?? '', this.sign(rawBody))) return null
    let data: unknown
    try {
      data = JSON.parse(rawBody)
    } catch {
      return null
    }
    const d = data as Record<string, unknown>
    const ok =
      typeof d['id'] === 'string' &&
      typeof d['intent'] === 'string' &&
      typeof d['currency'] === 'string' &&
      typeof d['amount'] === 'string' &&
      /^\d+$/.test(d['amount']) &&
      (PAYMENT_EVENT_TYPES as readonly unknown[]).includes(d['type'])
    if (!ok) return null
    return {
      provider: this.id,
      eventId: d['id'] as string,
      intentId: d['intent'] as string,
      type: d['type'] as PaymentEventType,
      amount: BigInt(d['amount'] as string),
      currency: d['currency'] as string,
    }
  }

  private same(a: string, b: string): boolean {
    const x = Buffer.from(a)
    const y = Buffer.from(b)
    return x.length === y.length && timingSafeEqual(x, y)
  }
}
