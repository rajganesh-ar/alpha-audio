import { LedgerError } from '../ledger/errors'
import type { LedgerService } from '../ledger/LedgerService'
import type { Id } from '../ledger/types'
import type { PaymentEvent, PaymentProvider } from '../payments/types'
import type { PricedBag } from './pricing'
import type { CheckoutStore, EventOutcome, OrderRecord, StartResult } from './types'

export interface StartInput {
  market: string
  /** Priced by the server from the catalogue now (`priceBag`); never from the client. */
  bag: PricedBag
  idempotencyKey: string
  method: string
  locale: string
  /** Where the provider returns the shopper; the app includes the order's access token. */
  returnUrl: (orderNumber: string) => string
  details: Readonly<Record<string, unknown>>
}

/**
 * The checkout state machine (docs/tasks/0009). Stock is held per line for the cart's 15
 * minutes, all lines or none; payment confirms the order and turns the holds into order holds;
 * every step is idempotent and every transition a compare-and-set, so retries, double submits
 * and duplicate webhooks cannot create a second order or move stock twice.
 */
export class CheckoutService {
  constructor(
    private readonly store: CheckoutStore,
    private readonly ledger: LedgerService,
    private readonly payments: PaymentProvider,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async start(input: StartInput): Promise<StartResult> {
    const existing = await this.store.findByIdempotencyKey(input.idempotencyKey)
    if (existing) return this.resume(existing, input)
    if (input.bag.problems.length || input.bag.lines.length === 0)
      return { ok: false, reason: 'bag-invalid' }

    const number = await this.store.nextOrderNumber(input.market, this.now())
    const { order, created } = await this.store.insertOrder({
      number,
      market: input.market,
      status: 'reserving',
      idempotencyKey: input.idempotencyKey,
      lines: input.bag.lines,
      totals: input.bag.totals,
      reservations: [],
      holdExpiresAt: null,
      payment: { provider: this.payments.id, intentId: null, status: null },
      failureReason: null,
      unavailableSkus: [],
      details: input.details,
    })
    if (!created) return this.resume(order, input)

    const held: Array<{ id: Id; expiresAt: Date | null }> = []
    const missing: string[] = []
    for (const line of order.lines) {
      const r = await this.ledger.reserve({
        sku: line.sku,
        qty: line.qty,
        market: input.market,
        doc: { type: 'cart', id: order.number },
      })
      if (r.ok) held.push({ id: r.reservation.id, expiresAt: r.reservation.expiresAt })
      else missing.push(line.sku)
    }
    if (missing.length) {
      await this.releaseAll(held.map((h) => h.id))
      await this.store.transition(order.id, ['reserving'], 'unavailable', {
        unavailableSkus: missing,
      })
      return {
        ok: false,
        reason: 'unavailable',
        order: { ...order, status: 'unavailable', unavailableSkus: missing },
        skus: missing,
      }
    }
    const expiries = held.map((h) => h.expiresAt?.getTime() ?? Infinity)
    const holdExpiresAt = new Date(Math.min(...expiries))
    const reservations = held.map((h) => h.id)
    await this.store.update(order.id, { reservations, holdExpiresAt })

    try {
      const intent = await this.payments.createPayment({
        orderNumber: order.number,
        amount: order.totals.total,
        method: input.method,
        returnUrl: input.returnUrl(order.number),
        idempotencyKey: input.idempotencyKey,
        locale: input.locale,
      })
      const payment = {
        provider: intent.provider,
        intentId: intent.intentId,
        status: 'pending' as const,
      }
      await this.store.transition(order.id, ['reserving'], 'paying', { payment })
      return {
        ok: true,
        order: { ...order, status: 'paying', reservations, holdExpiresAt, payment },
        redirectUrl: intent.redirectUrl,
      }
    } catch {
      await this.releaseAll(reservations)
      await this.store.transition(order.id, ['reserving'], 'failed', {
        failureReason: 'payment-error',
      })
      return {
        ok: false,
        reason: 'payment-error',
        order: { ...order, status: 'failed', failureReason: 'payment-error' },
      }
    }
  }

  /** A resubmitted checkout: the same order, and the same payment while it is still open. */
  private async resume(order: OrderRecord, input: StartInput): Promise<StartResult> {
    if (order.status === 'paying' && order.payment.intentId) {
      const intent = await this.payments.createPayment({
        orderNumber: order.number,
        amount: order.totals.total,
        method: input.method,
        returnUrl: input.returnUrl(order.number),
        idempotencyKey: order.idempotencyKey,
        locale: input.locale,
      })
      return { ok: true, order, redirectUrl: intent.redirectUrl }
    }
    if (order.status === 'unavailable')
      return { ok: false, reason: 'unavailable', order, skus: order.unavailableSkus }
    if (order.status === 'reserving' || order.status === 'confirming') {
      return { ok: false, reason: 'in-progress', order }
    }
    return { ok: false, reason: 'already-closed', order }
  }

  async handlePaymentEvent(
    event: PaymentEvent,
    payloadHash: string,
  ): Promise<{ outcome: EventOutcome; order?: OrderRecord }> {
    if (!(await this.store.recordEvent(event.provider, event.eventId, payloadHash)))
      return { outcome: 'duplicate' }
    const order = await this.store.findByIntent(event.provider, event.intentId)
    if (!order) return { outcome: 'unknown-intent' }

    if (event.type === 'declined' || event.type === 'failed') {
      const won = await this.store.transition(
        order.id,
        ['reserving', 'paying', 'expired'],
        'failed',
        {
          failureReason: 'declined',
          payment: { ...order.payment, status: event.type },
        },
      )
      if (!won) return { outcome: 'ignored', order }
      await this.releaseAll(order.reservations)
      return { outcome: 'failed', order }
    }

    if (
      event.amount !== order.totals.total.amount ||
      event.currency !== order.totals.total.currency
    ) {
      const won = await this.store.transition(order.id, ['paying', 'expired'], 'failed', {
        failureReason: 'amount-mismatch',
      })
      if (won) await this.releaseAll(order.reservations)
      return { outcome: 'mismatch', order }
    }
    if (order.status === 'confirmed' || order.status === 'confirming')
      return { outcome: 'already-confirmed', order }
    if (!(await this.store.transition(order.id, ['paying', 'expired'], 'confirming')))
      return { outcome: 'ignored', order }

    const doc = { type: 'order' as const, id: order.number }
    const holds: Id[] = []
    for (const [i, line] of order.lines.entries()) {
      const reservation = order.reservations[i]
      try {
        if (reservation === undefined)
          throw new LedgerError('reservation-not-found', 'No hold for this line.')
        holds.push((await this.ledger.confirm(reservation, { doc })).id)
      } catch (error) {
        if (!(error instanceof LedgerError)) throw error
        // The cart hold lapsed (late payment): hold again for the order if the stock is still there.
        const again = await this.ledger.reserve({
          sku: line.sku,
          qty: line.qty,
          market: order.market,
          doc,
          expiresAt: null,
        })
        if (again.ok) holds.push(again.reservation.id)
        else {
          await this.releaseAll(holds)
          await this.store.transition(order.id, ['confirming'], 'failed', {
            failureReason: 'stock-lost',
            reservations: [],
            payment: { ...order.payment, status: event.type },
          })
          return { outcome: 'stock-lost', order }
        }
      }
    }
    await this.store.transition(order.id, ['confirming'], 'confirmed', {
      reservations: holds,
      holdExpiresAt: null,
      payment: { ...order.payment, status: event.type },
    })
    return {
      outcome: 'confirmed',
      order: { ...order, status: 'confirmed', reservations: holds, holdExpiresAt: null },
    }
  }

  /** Orders still paying after their holds lapsed become `expired` (job `expireCheckouts`). */
  async expire(limit = 100): Promise<number> {
    let expired = 0
    for (const order of await this.store.listExpired(this.now(), limit)) {
      if (await this.store.transition(order.id, ['paying'], 'expired')) {
        await this.releaseAll(order.reservations)
        expired++
      }
    }
    return expired
  }

  /** Releases holds that are still active; ones the expiry job already released are skipped. */
  private async releaseAll(ids: readonly Id[]): Promise<void> {
    for (const id of ids) {
      try {
        await this.ledger.release(id, { reason: 'checkout' })
      } catch (error) {
        if (!(error instanceof LedgerError)) throw error
      }
    }
  }
}
