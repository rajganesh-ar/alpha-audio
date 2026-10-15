import type { Id } from '../ledger/types'
import {
  CREDIT_STATUSES,
  type NewTradeOrder,
  type TradeOrderPatch,
  type TradeOrderRecord,
  type TradeOrderStatus,
  type TradeOrderStore,
} from './types'

/** In-memory dealer order store for unit tests (Postgres: `@alpha/payload` system store). */
export class MemoryTradeOrderStore implements TradeOrderStore {
  readonly orders: TradeOrderRecord[] = []
  readonly details = new Map<Id, Readonly<Record<string, unknown>>>()
  private sequence = 0
  private readonly locks = new Map<string, Promise<unknown>>()

  async nextOrderNumber(market: string, now: Date) {
    return `T-${market.toUpperCase()}-${now.getUTCFullYear()}-${String(++this.sequence).padStart(6, '0')}`
  }

  async findByIdempotencyKey(key: string) {
    const order = this.orders.find((o) => o.idempotencyKey === key)
    return order ? structuredClone(order) : null
  }

  async findByNumber(number: string) {
    const order = this.orders.find((o) => o.number === number)
    return order ? structuredClone(order) : null
  }

  async insertOrder({ details, ...order }: NewTradeOrder) {
    const existing = await this.findByIdempotencyKey(order.idempotencyKey)
    if (existing) return { order: existing, created: false }
    const record = { ...structuredClone(order), id: this.orders.length + 1 }
    this.orders.push(record)
    this.details.set(record.id, details)
    return { order: structuredClone(record), created: true }
  }

  async transition(
    id: Id,
    from: readonly TradeOrderStatus[],
    to: TradeOrderStatus,
    patch: TradeOrderPatch = {},
  ) {
    const order = this.orders.find((o) => o.id === id)
    if (!order || !from.includes(order.status)) return false
    Object.assign(order, structuredClone(patch), { status: to })
    return true
  }

  async creditUsed(company: Id) {
    return this.orders
      .filter(
        (o) =>
          o.company === company &&
          (CREDIT_STATUSES as readonly TradeOrderStatus[]).includes(o.status),
      )
      .reduce((sum, o) => sum + o.totals.gross.amount, 0n)
  }

  async withCompanyLock<T>(company: Id, fn: () => Promise<T>): Promise<T> {
    const key = String(company)
    const previous = this.locks.get(key) ?? Promise.resolve()
    const run = previous.then(fn, fn)
    this.locks.set(
      key,
      run.catch(() => undefined),
    )
    return run
  }
}
