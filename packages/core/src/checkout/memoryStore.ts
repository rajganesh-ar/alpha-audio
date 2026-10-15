import type { Id } from '../ledger/types'
import type { CheckoutStore, NewOrder, OrderPatch, OrderRecord, OrderStatus } from './types'

/** In-memory checkout store for unit tests (Postgres: `@alpha/payload` system store). */
export class MemoryCheckoutStore implements CheckoutStore {
  readonly orders = new Map<string, OrderRecord & { details: NewOrder['details'] }>()
  readonly events = new Set<string>()
  private sequence = 0

  async nextOrderNumber(market: string, now: Date): Promise<string> {
    return `${market.toUpperCase()}-${now.getUTCFullYear()}-${String(++this.sequence).padStart(6, '0')}`
  }

  private copy(o: OrderRecord): OrderRecord {
    return structuredClone(o)
  }

  async findByIdempotencyKey(key: string) {
    const o = [...this.orders.values()].find((x) => x.idempotencyKey === key)
    return o ? this.copy(o) : null
  }

  async findByIntent(provider: string, intentId: string) {
    const o = [...this.orders.values()].find(
      (x) => x.payment.provider === provider && x.payment.intentId === intentId,
    )
    return o ? this.copy(o) : null
  }

  async insertOrder(order: NewOrder) {
    // Check and insert in one synchronous step, as the unique index does in Postgres.
    const existing = [...this.orders.values()].find(
      (x) => x.idempotencyKey === order.idempotencyKey,
    )
    if (existing) return { order: this.copy(existing), created: false }
    const record = { ...structuredClone(order), id: this.orders.size + 1 }
    this.orders.set(String(record.id), record)
    return { order: this.copy(record), created: true }
  }

  async transition(id: Id, from: readonly OrderStatus[], to: OrderStatus, patch: OrderPatch = {}) {
    const o = this.orders.get(String(id))
    if (!o || !from.includes(o.status)) return false
    Object.assign(o, structuredClone(patch), { status: to })
    return true
  }

  async update(id: Id, patch: OrderPatch) {
    const o = this.orders.get(String(id))
    if (o) Object.assign(o, structuredClone(patch))
  }

  async recordEvent(provider: string, eventId: string) {
    const key = `${provider}:${eventId}`
    if (this.events.has(key)) return false
    this.events.add(key)
    return true
  }

  async listExpired(now: Date, limit: number) {
    return [...this.orders.values()]
      .filter((o) => o.status === 'paying' && o.holdExpiresAt !== null && o.holdExpiresAt <= now)
      .slice(0, limit)
      .map((o) => this.copy(o))
  }
}
