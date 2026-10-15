import { LedgerError } from '../ledger/errors'
import type { Actor, LedgerService } from '../ledger/LedgerService'
import type { Id, ReservationStatus } from '../ledger/types'
import type { PaymentProvider } from '../payments/types'
import type {
  FulfilmentOrder,
  FulfilmentPatch,
  FulfilmentResult,
  FulfilmentStatus,
  FulfilmentStore,
  Notify,
  RefundStatus,
  ShipmentInput,
} from './types'

/** What the ledger says when a concurrent run of the same step moved the hold first. */
const RACE_CODES = new Set(['reservation-wrong-status', 'reservation-not-active'])
const TRACKING = /^[A-Za-z0-9][A-Za-z0-9 -]{2,63}$/

/**
 * Takes a confirmed order from the queue to the customer (docs/tasks/0010): pick, ship,
 * deliver, or cancel before shipment. Every step claims the order with a compare-and-set on its
 * fulfilment status, moves each hold through the ledger (which refuses a hold in the wrong
 * status, so nothing moves twice), then releases the claim. A step that died half-way is
 * resumed by running it again: holds already moved are skipped.
 */
export class FulfilmentService {
  constructor(
    private readonly store: FulfilmentStore,
    private readonly ledger: LedgerService,
    private readonly payments: PaymentProvider | null,
    private readonly notify: Notify,
    private readonly now: () => Date = () => new Date(),
  ) {}

  pick(number: string, actor: Actor = {}): Promise<FulfilmentResult> {
    return this.step(number, {
      from: 'awaiting',
      claim: 'picking',
      to: 'picked',
      move: async (id, status) => {
        if (status === 'active') await this.ledger.pick(id, actor)
        else if (status !== 'picked') return false
        return true
      },
    })
  }

  async ship(number: string, input: ShipmentInput, actor: Actor = {}): Promise<FulfilmentResult> {
    const courier = input.courier.trim()
    const trackingNumber = input.trackingNumber.trim()
    const trackingUrl = input.trackingUrl?.trim() || null
    if (
      !courier ||
      courier.length > 60 ||
      !TRACKING.test(trackingNumber) ||
      (trackingUrl !== null && !/^https:\/\/\S+$/.test(trackingUrl))
    ) {
      return { ok: false, reason: 'invalid-shipment' }
    }
    let shipment: Awaited<ReturnType<FulfilmentStore['ensureShipment']>> | undefined
    return this.step(number, {
      from: 'picked',
      claim: 'shipping',
      to: 'shipped',
      before: async (order) => {
        shipment = await this.store.ensureShipment(
          order,
          { courier, trackingNumber, trackingUrl },
          this.now(),
        )
      },
      move: async (id, status) => {
        if (!shipment) return false
        if (status === 'picked')
          await this.ledger.shipReservation(id, {
            ...actor,
            doc: { type: 'shipment', id: shipment.number },
          })
        else if (status !== 'shipped' && status !== 'delivered') return false
        return true
      },
      patch: () => (shipment ? { shipment } : {}),
      after: (order) => this.notify(order, 'order-shipped'),
    })
  }

  deliver(number: string, actor: Actor = {}): Promise<FulfilmentResult> {
    let order: FulfilmentOrder | undefined
    return this.step(number, {
      from: 'shipped',
      claim: 'delivering',
      to: 'delivered',
      before: async (o) => {
        order = o
      },
      move: async (id, status) => {
        const shipment = order?.shipment
        if (!shipment) return false
        if (status === 'shipped')
          await this.ledger.deliverReservation(id, {
            ...actor,
            doc: { type: 'shipment', id: shipment.number },
          })
        else if (status !== 'delivered') return false
        return true
      },
      after: async (o) => {
        if (o.shipment) await this.store.markShipmentDelivered(o.shipment, this.now())
        await this.notify(o, 'order-delivered')
      },
    })
  }

  /**
   * Cancels an order that has not shipped: every hold goes back to `available` (released if
   * still reserved, returned to the shelf if picked), then the payment is refunded.
   */
  async cancel(number: string, reason: string, actor: Actor = {}): Promise<FulfilmentResult> {
    const why = reason.trim().slice(0, 300)
    if (!why) return { ok: false, reason: 'wrong-status', detail: 'A cancellation needs a reason.' }
    const result = await this.step(number, {
      from: ['awaiting', 'picked'],
      claim: 'cancelling',
      to: 'cancelled',
      claimPatch: { cancelReason: why },
      move: async (id, status) => {
        if (status === 'active') await this.ledger.release(id, { ...actor, reason: why })
        else if (status === 'picked') await this.ledger.returnToStock(id, { ...actor, reason: why })
        else if (status !== 'released' && status !== 'expired') return false
        return true
      },
      after: (order) => this.notify(order, 'order-cancelled'),
    })
    if (!result.ok) return result
    const refunded = await this.refund(number)
    return refunded.ok ? { ...refunded, changed: result.changed || refunded.changed } : result
  }

  /**
   * Refunds the full amount of a cancelled order, or of a paid order that failed because its
   * stock had gone (`stock-lost`). A provider without refunds leaves it `manual` for staff;
   * a provider error leaves it `failed`, and running refund again retries with the same key.
   */
  async refund(number: string): Promise<FulfilmentResult> {
    const order = await this.store.findByNumber(number)
    if (!order) return { ok: false, reason: 'not-found' }
    const eligible =
      (order.fulfilment === 'cancelled' ||
        (order.status === 'failed' && order.failureReason === 'stock-lost')) &&
      (order.payment.status === 'captured' || order.payment.status === 'authorised') &&
      order.payment.intentId !== null
    if (!eligible) return { ok: false, reason: 'not-refundable', order }
    if (order.refund.status !== 'none' && order.refund.status !== 'failed')
      return { ok: true, order, changed: false }
    if (!(await this.store.claimRefund(order.id))) return { ok: true, order, changed: false }

    const amount = order.totals.total
    const set = async (status: RefundStatus, reference: string | null, error: string | null) => {
      const refund = { status, amount, reference, error }
      await this.store.setRefund(order.id, refund)
      return { ok: true as const, order: { ...order, refund }, changed: true }
    }
    if (!this.payments?.refund) return set('manual', null, null)
    try {
      const { refundId } = await this.payments.refund({
        intentId: order.payment.intentId as string,
        amount,
        idempotencyKey: `refund:${order.number}`,
        reason: order.cancelReason ?? order.failureReason ?? undefined,
      })
      return await set('refunded', refundId, null)
    } catch (error) {
      return set(
        'failed',
        null,
        error instanceof Error ? error.message.slice(0, 300) : 'refund failed',
      )
    }
  }

  private async step(
    number: string,
    plan: {
      from: FulfilmentStatus | readonly FulfilmentStatus[]
      claim: FulfilmentStatus
      to: FulfilmentStatus
      claimPatch?: FulfilmentPatch
      before?: (order: FulfilmentOrder) => Promise<void>
      /** Moves one hold; false when the hold is in a status this step cannot handle. */
      move: (id: Id, status: ReservationStatus) => Promise<boolean>
      patch?: () => FulfilmentPatch
      after?: (order: FulfilmentOrder) => Promise<void>
    },
  ): Promise<FulfilmentResult> {
    const order = await this.store.findByNumber(number)
    if (!order) return { ok: false, reason: 'not-found' }
    if (order.status !== 'confirmed') return { ok: false, reason: 'not-confirmed', order }
    const from = typeof plan.from === 'string' ? [plan.from] : plan.from
    if (order.fulfilment === plan.to) return { ok: true, order, changed: false }
    if (order.fulfilment !== plan.claim) {
      if (!from.includes(order.fulfilment)) return { ok: false, reason: 'wrong-status', order }
      const claimed = await this.store.transition(order.id, from, plan.claim, plan.claimPatch ?? {})
      // Lost the race: another request moved the order; report where it is now.
      if (!claimed) {
        const now = await this.store.findByNumber(number)
        return now?.fulfilment === plan.to || now?.fulfilment === plan.claim
          ? { ok: true, order: now, changed: false }
          : { ok: false, reason: 'wrong-status', ...(now ? { order: now } : {}) }
      }
    }
    const claimed = { ...order, fulfilment: plan.claim, ...(plan.claimPatch ?? {}) }
    await plan.before?.(claimed)
    for (const id of order.reservations) {
      const held = await this.ledger.reservation(id)
      try {
        if (!held || !(await plan.move(id, held.status)))
          return { ok: false, reason: 'hold-missing', order: claimed, detail: String(id) }
      } catch (error) {
        // A concurrent run of this step moved the hold first; it is done either way.
        if (!(error instanceof LedgerError) || !RACE_CODES.has(error.code)) throw error
        const again = await this.ledger.reservation(id)
        if (!again || !(await plan.move(id, again.status)))
          return { ok: false, reason: 'hold-missing', order: claimed, detail: String(id) }
      }
    }
    const patch = plan.patch?.() ?? {}
    const done = { ...claimed, ...patch, fulfilment: plan.to }
    if (await this.store.transition(order.id, [plan.claim], plan.to, patch)) {
      await plan.after?.(done)
      return { ok: true, order: done, changed: true }
    }
    return { ok: true, order: done, changed: false }
  }
}
