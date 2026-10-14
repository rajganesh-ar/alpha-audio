import type { MemoryLedgerStore } from '../ledger/memoryStore'
import type { Id } from '../ledger/types'
import type { PurchasingStore, PurchasingTx } from './store'
import type { PoStatus, PurchaseOrderRecord, ReceiptLine, ReceiptRecord } from './types'

export interface MemoryPurchaseOrder extends Omit<PurchaseOrderRecord, 'id'> {
  id: Id
  market: string
}

export interface MemoryReceipt {
  id: Id
  number: string
  purchaseOrder: Id
  location: Id
  locationWarehouse: Id
  lines: ReceiptLine[]
  status?: ReceiptRecord['status']
}

interface State {
  locations: Map<string, Id>
  orders: Map<string, MemoryPurchaseOrder>
  receipts: Map<string, ReceiptRecord & { postedAt?: Date; putawayLocation?: Id }>
}

/**
 * In-memory purchasing store for unit tests. Runs inside the memory ledger's transaction and
 * rolls back with it, which is what the Postgres store gets from one database transaction.
 */
export class MemoryPurchasingStore implements PurchasingStore {
  private state: State = { locations: new Map(), orders: new Map(), receipts: new Map() }

  constructor(private readonly ledgerStore: MemoryLedgerStore) {}

  addLocation(id: Id, warehouse: Id): void {
    this.state.locations.set(String(id), warehouse)
  }

  addPurchaseOrder(po: MemoryPurchaseOrder): void {
    this.state.orders.set(String(po.id), structuredClone(po))
  }

  addReceipt(receipt: MemoryReceipt): void {
    this.state.receipts.set(String(receipt.id), {
      ...structuredClone(receipt),
      status: receipt.status ?? 'draft',
      putAway: false,
    })
  }

  purchaseOrder(id: Id): MemoryPurchaseOrder | undefined {
    return this.state.orders.get(String(id))
  }

  receipt(id: Id): (ReceiptRecord & { postedAt?: Date; putawayLocation?: Id }) | undefined {
    return this.state.receipts.get(String(id))
  }

  transaction<T>(work: (tx: PurchasingTx) => Promise<T>): Promise<T> {
    return this.ledgerStore.transaction(async (ledger) => {
      const snapshot = structuredClone(this.state)
      const s = this.state
      try {
        return await work({
          ledger,
          lockReceipt: async (id) => {
            const r = s.receipts.get(String(id))
            return r ? structuredClone(r) : null
          },
          lockPurchaseOrder: async (id) => {
            const po = s.orders.get(String(id))
            return po ? structuredClone(po) : null
          },
          locationWarehouse: async (id) => s.locations.get(String(id)) ?? null,
          markReceiptPosted: async (id, at) => {
            const r = s.receipts.get(String(id))
            if (r) Object.assign(r, { status: 'posted', postedAt: at })
          },
          markReceiptPutAway: async (id, _at, _user, location) => {
            const r = s.receipts.get(String(id))
            if (r) Object.assign(r, { putAway: true, putawayLocation: location })
          },
          updatePurchaseOrder: async (id, received, status: PoStatus) => {
            const po = s.orders.get(String(id))
            if (!po) return
            po.status = status
            for (const line of po.lines)
              line.qtyReceived = received.get(line.id) ?? line.qtyReceived
          },
        })
      } catch (error) {
        this.state = snapshot
        throw error
      }
    })
  }

  async openPurchaseEta(sku: string, market: string): Promise<Date | null> {
    const dates = [...this.state.orders.values()]
      .filter(
        (po) =>
          po.market === market &&
          (po.status === 'ordered' || po.status === 'partially_received') &&
          po.expectedAt,
      )
      .filter((po) => po.lines.some((l) => l.sku === sku && l.qtyReceived < l.qtyOrdered))
      .map((po) => po.expectedAt as Date)
      .sort((a, b) => a.getTime() - b.getTime())
    return dates[0] ?? null
  }
}
