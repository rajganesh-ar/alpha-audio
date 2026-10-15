import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres/drizzle'
import {
  FulfilmentService,
  money,
  type CurrencyCode,
  type CurrencyDecimals,
  type FulfilmentOrder,
  type FulfilmentPatch,
  type FulfilmentStatus,
  type FulfilmentStore,
  type Id,
  type OrderRefund,
  type PaymentProvider,
  type RefundStatus,
  type ShipmentInput,
  type ShipmentRef,
} from '@alpha/core'
import type { MarketCode } from '../markets/codes'
import { toOrderRecord } from './checkoutStore'
import { createLedger, drizzleOf } from './ledgerStore'
import { queueNotification } from './notifications'

/**
 * Postgres store for fulfilment (docs/tasks/0010). System code: orders and shipments are
 * system-written, so they are written with `overrideAccess: true` here and nowhere else. Every
 * fulfilment status change is a compare-and-set in SQL.
 */

interface FulfilmentDoc {
  id: number
  number: string
  currency: string
  decimals: number
  fulfilment?: FulfilmentStatus | null
  cancelReason?: string | null
  shipment?: { id: number; number: string } | number | null
  refund?: {
    status?: RefundStatus | null
    amount?: number | null
    reference?: string | null
    error?: string | null
  } | null
}

const isUnique = (error: unknown) => {
  const e = error as { name?: string; code?: string; cause?: { code?: string } }
  return e.code === '23505' || e.cause?.code === '23505' || e.name === 'ValidationError'
}

export class PostgresFulfilmentStore implements FulfilmentStore {
  constructor(private readonly payload: Payload) {}

  private get db() {
    return drizzleOf(this.payload)
  }

  async findByNumber(number: string): Promise<FulfilmentOrder | null> {
    const { docs } = await this.payload.find({
      collection: 'orders',
      where: { number: { equals: number } },
      limit: 1,
      depth: 1,
      // System read: fulfilment acts for staff on system-written fields.
      overrideAccess: true,
    })
    const doc = docs[0] as unknown as
      (FulfilmentDoc & Parameters<typeof toOrderRecord>[0]) | undefined
    if (!doc) return null
    const order = toOrderRecord(doc)
    const refund = doc.refund ?? {}
    const shipment =
      typeof doc.shipment === 'object' && doc.shipment
        ? { id: doc.shipment.id, number: doc.shipment.number }
        : null
    return {
      id: order.id,
      number: order.number,
      market: order.market,
      status: order.status,
      failureReason: order.failureReason,
      fulfilment: doc.fulfilment ?? 'awaiting',
      lines: order.lines,
      totals: order.totals,
      reservations: order.reservations,
      payment: order.payment,
      refund: {
        status: refund.status ?? 'none',
        amount:
          refund.amount === null || refund.amount === undefined
            ? null
            : money(
                Number(refund.amount),
                doc.currency as CurrencyCode,
                Number(doc.decimals) as CurrencyDecimals,
              ),
        reference: refund.reference ?? null,
        error: refund.error ?? null,
      },
      shipment,
      cancelReason: doc.cancelReason ?? null,
    }
  }

  async transition(
    id: Id,
    from: readonly FulfilmentStatus[],
    to: FulfilmentStatus,
    patch: FulfilmentPatch = {},
  ) {
    const sets = [sql`fulfilment = ${to}`, sql`updated_at = now()`]
    if (patch.cancelReason !== undefined) sets.push(sql`cancel_reason = ${patch.cancelReason}`)
    if (patch.shipment !== undefined) sets.push(sql`shipment_id = ${Number(patch.shipment.id)}`)
    const { rows } = await this.db.execute(sql`
      UPDATE orders SET ${sql.join(sets, sql`, `)}
      WHERE id = ${Number(id)} AND fulfilment::text IN (${sql.join(
        from.map((s) => sql`${s}`),
        sql`, `,
      )})
      RETURNING id`)
    return rows.length === 1
  }

  async ensureShipment(
    order: FulfilmentOrder,
    input: ShipmentInput,
    now: Date,
  ): Promise<ShipmentRef> {
    const existing = async () => {
      const { docs } = await this.payload.find({
        collection: 'shipments',
        where: { order: { equals: Number(order.id) } },
        limit: 1,
        depth: 0,
        // System read: see the module comment.
        overrideAccess: true,
      })
      return docs[0] ? { id: docs[0].id, number: docs[0].number } : null
    }
    const found = await existing()
    if (found) return found
    const { rows } = await this.db.execute(sql`SELECT nextval('shipment_number_seq') AS n`)
    const number = `SH-${now.getUTCFullYear()}-${String(rows[0]?.['n']).padStart(6, '0')}`
    try {
      const doc = await this.payload.create({
        collection: 'shipments',
        data: {
          number,
          order: Number(order.id),
          market: order.market as MarketCode,
          status: 'shipped',
          courier: input.courier,
          trackingNumber: input.trackingNumber,
          trackingUrl: input.trackingUrl ?? null,
          shippedAt: now.toISOString(),
        },
        depth: 0,
        // System write: shipments are system-written; the order's one shipment (unique order).
        overrideAccess: true,
      })
      return { id: doc.id, number: doc.number }
    } catch (error) {
      // A concurrent ship created it first (unique order): that is the shipment.
      if (isUnique(error)) {
        const raced = await existing()
        if (raced) return raced
      }
      throw error
    }
  }

  async markShipmentDelivered(shipment: ShipmentRef, now: Date) {
    await this.payload.update({
      collection: 'shipments',
      id: Number(shipment.id),
      data: { status: 'delivered', deliveredAt: now.toISOString() },
      depth: 0,
      // System write: see the module comment.
      overrideAccess: true,
    })
  }

  async claimRefund(id: Id) {
    const { rows } = await this.db.execute(sql`
      UPDATE orders SET refund_status = 'pending', updated_at = now()
      WHERE id = ${Number(id)} AND refund_status::text IN ('none', 'failed')
      RETURNING id`)
    return rows.length === 1
  }

  async setRefund(id: Id, refund: OrderRefund) {
    await this.db.execute(sql`
      UPDATE orders SET refund_status = ${refund.status},
        refund_amount = ${refund.amount === null ? null : Number(refund.amount.amount)},
        refund_reference = ${refund.reference}, refund_error = ${refund.error}, updated_at = now()
      WHERE id = ${Number(id)}`)
  }
}

/** Fulfilment for this Payload instance; customer emails go through the notification outbox. */
export function createFulfilment(
  payload: Payload,
  payments: PaymentProvider | null,
  now?: () => Date,
): FulfilmentService {
  return new FulfilmentService(
    new PostgresFulfilmentStore(payload),
    createLedger(payload, now),
    payments,
    async (order, template) => {
      await queueNotification(payload, Number(order.id), template)
    },
    now,
  )
}
