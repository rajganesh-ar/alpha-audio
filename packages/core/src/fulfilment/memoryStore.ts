import type { Id } from '../ledger/types'
import type {
  FulfilmentOrder,
  FulfilmentPatch,
  FulfilmentStatus,
  FulfilmentStore,
  OrderRefund,
  ShipmentInput,
  ShipmentRef,
} from './types'

/** In-memory fulfilment store for unit tests (Postgres: `@alpha/payload` system store). */
export class MemoryFulfilmentStore implements FulfilmentStore {
  readonly orders = new Map<string, FulfilmentOrder>()
  readonly shipments = new Map<
    string,
    ShipmentRef & ShipmentInput & { order: string; deliveredAt: Date | null }
  >()

  add(order: FulfilmentOrder): void {
    this.orders.set(order.number, structuredClone(order))
  }

  private byId(id: Id): FulfilmentOrder | undefined {
    return [...this.orders.values()].find((o) => o.id === id)
  }

  async findByNumber(number: string) {
    const order = this.orders.get(number)
    return order ? structuredClone(order) : null
  }

  async transition(
    id: Id,
    from: readonly FulfilmentStatus[],
    to: FulfilmentStatus,
    patch: FulfilmentPatch = {},
  ) {
    const order = this.byId(id)
    if (!order || !from.includes(order.fulfilment)) return false
    Object.assign(order, patch, { fulfilment: to })
    return true
  }

  async ensureShipment(order: FulfilmentOrder, input: ShipmentInput) {
    const existing = this.shipments.get(order.number)
    if (existing) return { id: existing.id, number: existing.number }
    const ref = {
      id: this.shipments.size + 1,
      number: `SH-2026-${String(this.shipments.size + 1).padStart(6, '0')}`,
    }
    this.shipments.set(order.number, { ...ref, ...input, order: order.number, deliveredAt: null })
    return ref
  }

  async markShipmentDelivered(shipment: ShipmentRef, now: Date) {
    for (const s of this.shipments.values()) if (s.id === shipment.id) s.deliveredAt = now
  }

  async claimRefund(id: Id) {
    const order = this.byId(id)
    if (!order || (order.refund.status !== 'none' && order.refund.status !== 'failed')) return false
    order.refund = { ...order.refund, status: 'pending' }
    return true
  }

  async setRefund(id: Id, refund: OrderRefund) {
    const order = this.byId(id)
    if (order) order.refund = structuredClone(refund)
  }
}
