import { timingSafeEqual } from 'node:crypto'
import type { Payload, Where } from 'payload'
import { sql, type SQL } from '@payloadcms/db-postgres/drizzle'
import {
  CheckoutService,
  money,
  type CheckoutStore,
  type CurrencyCode,
  type CurrencyDecimals,
  type FailureReason,
  type Id,
  type NewOrder,
  type OrderPatch,
  type OrderRecord,
  type OrderStatus,
  type PaymentProvider,
  type PricedLine,
} from '@alpha/core'
import type { LocaleCode, MarketCode } from '../markets/codes'
import { hashToken } from './cartStore'
import { createLedger, drizzleOf } from './ledgerStore'

/**
 * Postgres store for the checkout (docs/tasks/0009). System code: orders are written with
 * `overrideAccess: true` (their fields are system-written; no user may set them) and every
 * status change is a compare-and-set in SQL, so concurrent webhooks and resubmits serialise on
 * the order row without a lock held across the payment call.
 */

interface OrderDoc {
  id: number
  number: string
  market: string
  status: OrderStatus
  idempotencyKey: string
  currency: string
  decimals: number
  lines?: Array<{
    product?: number | { id: number } | null
    sku: string
    title: string
    qty: number
    unitPrice: number
    lineTotal: number
    vat: number
  }> | null
  totals: { subtotal: number; vat: number; delivery: number; total: number }
  reservations?: unknown
  unavailableSkus?: unknown
  holdExpiresAt?: string | null
  payment?: {
    provider?: string | null
    intentId?: string | null
    status?: OrderRecord['payment']['status']
  } | null
  failureReason?: FailureReason | null
}

const ids = (value: unknown): Id[] =>
  Array.isArray(value)
    ? value.filter((v): v is Id => typeof v === 'number' || typeof v === 'string')
    : []
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []

export function toOrderRecord(doc: OrderDoc): OrderRecord {
  const m = (amount: number) =>
    money(Number(amount), doc.currency as CurrencyCode, Number(doc.decimals) as CurrencyDecimals)
  return {
    id: doc.id,
    number: doc.number,
    market: doc.market,
    status: doc.status,
    idempotencyKey: doc.idempotencyKey,
    lines: (doc.lines ?? []).map((l): PricedLine => ({
      sku: l.sku,
      productId: typeof l.product === 'object' && l.product ? l.product.id : (l.product ?? ''),
      title: l.title,
      qty: Number(l.qty),
      unitPrice: m(l.unitPrice),
      lineTotal: m(l.lineTotal),
      vat: m(l.vat),
    })),
    totals: {
      subtotal: m(doc.totals.subtotal),
      vat: m(doc.totals.vat),
      delivery: m(doc.totals.delivery),
      total: m(doc.totals.total),
    },
    reservations: ids(doc.reservations),
    holdExpiresAt: doc.holdExpiresAt ? new Date(doc.holdExpiresAt) : null,
    payment: {
      provider: doc.payment?.provider ?? '',
      intentId: doc.payment?.intentId ?? null,
      status: doc.payment?.status ?? null,
    },
    failureReason: doc.failureReason ?? null,
    unavailableSkus: strings(doc.unavailableSkus),
  }
}

function patchSql(patch: OrderPatch): SQL[] {
  const sets: SQL[] = [sql`updated_at = now()`]
  if (patch.reservations !== undefined)
    sets.push(sql`reservations = ${JSON.stringify(patch.reservations)}::jsonb`)
  if (patch.unavailableSkus !== undefined)
    sets.push(sql`unavailable_skus = ${JSON.stringify(patch.unavailableSkus)}::jsonb`)
  if (patch.holdExpiresAt !== undefined)
    sets.push(
      sql`hold_expires_at = ${patch.holdExpiresAt ? patch.holdExpiresAt.toISOString() : null}`,
    )
  if (patch.failureReason !== undefined) sets.push(sql`failure_reason = ${patch.failureReason}`)
  if (patch.payment !== undefined) {
    sets.push(
      sql`payment_provider = ${patch.payment.provider}`,
      sql`payment_intent_id = ${patch.payment.intentId}`,
      sql`payment_status = ${patch.payment.status}`,
    )
  }
  return sets
}

export class PostgresCheckoutStore implements CheckoutStore {
  constructor(private readonly payload: Payload) {}

  private get db() {
    return drizzleOf(this.payload)
  }

  private async findOne(where: Where): Promise<OrderRecord | null> {
    const { docs } = await this.payload.find({
      collection: 'orders',
      where,
      limit: 1,
      depth: 0,
      // System read: orders are staff-only, and the checkout acts for an anonymous shopper.
      overrideAccess: true,
    })
    const doc = docs[0] as unknown as OrderDoc | undefined
    return doc ? toOrderRecord(doc) : null
  }

  async nextOrderNumber(market: string, now: Date): Promise<string> {
    const { rows } = await this.db.execute(sql`SELECT nextval('order_number_seq') AS n`)
    return `${market.toUpperCase()}-${now.getUTCFullYear()}-${String(rows[0]?.['n']).padStart(6, '0')}`
  }

  findByIdempotencyKey(key: string) {
    return this.findOne({ idempotencyKey: { equals: key } })
  }

  findByIntent(provider: string, intentId: string) {
    return this.findOne({
      and: [
        { 'payment.provider': { equals: provider } },
        { 'payment.intentId': { equals: intentId } },
      ],
    })
  }

  async insertOrder(order: NewOrder) {
    const d = order.details as {
      contact?: { name?: string; email?: string; phone?: string }
      address?: Record<string, unknown>
      paymentMethod?: string
      locale?: LocaleCode
      accessTokenHash?: string
    }
    const n = (m: { amount: bigint }) => Number(m.amount)
    try {
      const doc = await this.payload.create({
        collection: 'orders',
        data: {
          number: order.number,
          status: order.status,
          channel: 'web',
          market: order.market as MarketCode,
          locale: d.locale ?? 'en',
          currency: order.totals.total.currency,
          decimals: order.totals.total.decimals,
          contact: d.contact ?? {},
          address: d.address ?? {},
          paymentMethod: d.paymentMethod ?? null,
          lines: order.lines.map((l) => ({
            product: typeof l.productId === 'number' ? l.productId : Number(l.productId) || null,
            sku: l.sku,
            title: l.title,
            qty: l.qty,
            unitPrice: n(l.unitPrice),
            lineTotal: n(l.lineTotal),
            vat: n(l.vat),
          })),
          totals: {
            subtotal: n(order.totals.subtotal),
            vat: n(order.totals.vat),
            delivery: n(order.totals.delivery),
            total: n(order.totals.total),
          },
          payment: {
            provider: order.payment.provider,
            intentId: order.payment.intentId,
            status: order.payment.status,
          },
          reservations: order.reservations,
          unavailableSkus: order.unavailableSkus,
          holdExpiresAt: order.holdExpiresAt?.toISOString() ?? null,
          idempotencyKey: order.idempotencyKey,
          accessTokenHash: d.accessTokenHash ?? '',
        },
        depth: 0,
        // System write: every order field is system-written; the shopper is anonymous.
        overrideAccess: true,
      })
      return { order: toOrderRecord(doc as unknown as OrderDoc), created: true }
    } catch (error) {
      // A concurrent submit with the same key won the unique index: that is the order.
      const existing = await this.findByIdempotencyKey(order.idempotencyKey)
      if (existing) return { order: existing, created: false }
      throw error
    }
  }

  async transition(id: Id, from: readonly OrderStatus[], to: OrderStatus, patch: OrderPatch = {}) {
    const { rows } = await this.db.execute(sql`
      UPDATE orders SET status = ${to}, ${sql.join(patchSql(patch), sql`, `)}
      WHERE id = ${Number(id)} AND status::text IN (${sql.join(
        from.map((s) => sql`${s}`),
        sql`, `,
      )})
      RETURNING id`)
    return rows.length === 1
  }

  async update(id: Id, patch: OrderPatch) {
    await this.db.execute(
      sql`UPDATE orders SET ${sql.join(patchSql(patch), sql`, `)} WHERE id = ${Number(id)}`,
    )
  }

  async recordEvent(provider: string, eventId: string, payloadHash: string) {
    const { rows } = await this.db.execute(sql`
      INSERT INTO webhook_events (provider, event_id, payload_hash, received_at, created_at, updated_at)
      VALUES (${provider}, ${eventId}, ${payloadHash}, now(), now(), now())
      ON CONFLICT (provider, event_id) DO NOTHING
      RETURNING id`)
    return rows.length === 1
  }

  async listExpired(now: Date, limit: number) {
    const { rows } = await this.db.execute(sql`
      SELECT id FROM orders WHERE status = 'paying' AND hold_expires_at IS NOT NULL AND hold_expires_at <= ${now.toISOString()}
      ORDER BY hold_expires_at LIMIT ${limit}`)
    const found = await Promise.all(
      rows.map((r) => this.findOne({ id: { equals: Number(r['id']) } })),
    )
    return found.filter((o): o is OrderRecord => o !== null)
  }
}

/** The checkout for this Payload instance, with the given payment provider. */
export function createCheckout(
  payload: Payload,
  provider: PaymentProvider,
  now?: () => Date,
): CheckoutService {
  return new CheckoutService(
    new PostgresCheckoutStore(payload),
    createLedger(payload, now),
    provider,
    now,
  )
}

/** What the shopper may see of their order: no idempotency key, token hash or reservation ids. */
export interface ShopperOrder {
  number: string
  market: string
  locale: string
  status: OrderStatus
  failureReason: FailureReason | null
  lines: PricedLine[]
  totals: OrderRecord['totals']
}

/**
 * The order behind a confirmation link, only when the link carries its access token (the token
 * is never stored; its SHA-256 is). Orders are staff-only, so this is a system read.
 */
export async function loadShopperOrder(
  payload: Payload,
  number: string,
  token: string,
): Promise<ShopperOrder | null> {
  if (!number || !token) return null
  const { docs } = await payload.find({
    collection: 'orders',
    where: { number: { equals: number } },
    limit: 1,
    depth: 0,
    showHiddenFields: true,
    // System read: the shopper is anonymous and proves the order is theirs with the token.
    overrideAccess: true,
  })
  const doc = docs[0] as unknown as
    (OrderDoc & { accessTokenHash?: string; locale: string }) | undefined
  if (!doc?.accessTokenHash) return null
  const expected = Buffer.from(doc.accessTokenHash)
  const given = Buffer.from(hashToken(token))
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  const order = toOrderRecord(doc)
  return {
    number: order.number,
    market: order.market,
    locale: doc.locale,
    status: order.status,
    failureReason: order.failureReason,
    lines: order.lines,
    totals: order.totals,
  }
}
