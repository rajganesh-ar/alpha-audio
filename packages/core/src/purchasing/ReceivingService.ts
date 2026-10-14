import type { LedgerOperation, LedgerService } from '../ledger/LedgerService'
import type { Id } from '../ledger/types'
import { ReceivingError } from './errors'
import type { PurchasingStore } from './store'
import {
  RECEIPT_EXCEPTIONS,
  type PoLine,
  type PoStatus,
  type PurchaseOrderRecord,
  type ReceiptLine,
  type ReceiptRecord,
} from './types'

export interface PostedReceipt {
  /** Units booked into the ledger (received). */
  booked: number
  /** Of those, units sent on to quarantine (damaged or wrong item). */
  quarantined: number
  /** Units that arrived without a serial label and were not booked. */
  unbooked: number
  poStatus: PoStatus
}

export interface PutawayResult {
  /** Units moved to `available`. */
  available: number
}

/** What one receipt line does to the ledger and to its PO line. */
interface LinePlan {
  line: ReceiptLine
  poLine: PoLine
  serialised: boolean
  wrongItem: boolean
  /** Bulk: units booked. Serialised: equals `serials.length`. */
  booked: number
  /** Bulk units or serials that go on to quarantine. */
  damagedQty: number
  damagedSerials: string[]
  /** Units without a serial label: counted at the dock, not booked. */
  unbooked: number
}

const OPEN: readonly PoStatus[] = ['ordered', 'partially_received']
const whole = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n)

/**
 * Goods receipt against purchase orders (docs/tasks/0005). Posting is the only way stock
 * enters the ledger from a supplier: it validates the receipt against its PO, writes the
 * movements, and updates the PO, all in one transaction. The receipt row is locked first, so
 * posting it twice, even in parallel, posts it once.
 */
export class ReceivingService {
  constructor(
    private readonly store: PurchasingStore,
    private readonly ledger: LedgerService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async postReceipt(
    receiptId: Id,
    actor: { user?: Id | null | undefined } = {},
  ): Promise<PostedReceipt> {
    return this.store.transaction(async (tx) => {
      const receipt = await tx.lockReceipt(receiptId)
      if (!receipt)
        throw new ReceivingError('receipt-not-found', `No goods receipt ${String(receiptId)}.`)
      if (receipt.status === 'posted')
        throw new ReceivingError(
          'receipt-already-posted',
          `Goods receipt ${receipt.number} is already posted.`,
        )
      const po = await this.openPo(tx.lockPurchaseOrder(receipt.purchaseOrder), receipt)
      const plans = this.plan(receipt, po)

      // Serial checks the ledger would also make, done first so the error names the serial.
      const serials = plans.flatMap((p) => p.line.serials)
      const known = await tx.ledger.lockSerials(serials)
      for (const [serial, record] of known) {
        if (record.state !== null) {
          throw new ReceivingError(
            'serial-duplicate',
            `Serial ${serial} is already in stock (${record.state}).`,
            { serial },
          )
        }
      }

      const doc = { type: 'receipt' as const, id: receipt.number }
      const user = actor.user ?? null
      const ops: LedgerOperation[] = []
      for (const p of plans) {
        const sku = p.line.sku
        const at = receipt.location
        if (p.serialised) {
          for (const serial of p.line.serials)
            ops.push({
              move: { sku, serial, qty: 1, from: null, to: 'received', location: at, doc, user },
            })
          for (const serial of p.damagedSerials)
            ops.push({
              move: {
                sku,
                serial,
                qty: 1,
                from: 'received',
                to: 'quarantine',
                location: at,
                doc,
                user,
              },
            })
        } else {
          ops.push({
            move: { sku, qty: p.booked, from: null, to: 'received', location: at, doc, user },
          })
          if (p.damagedQty > 0)
            ops.push({
              move: {
                sku,
                qty: p.damagedQty,
                from: 'received',
                to: 'quarantine',
                location: at,
                doc,
                user,
              },
            })
        }
      }
      await this.ledger.applyWithin(tx.ledger, ops)

      const received = new Map(po.lines.map((l) => [l.id, l.qtyReceived]))
      for (const p of plans) {
        if (!p.wrongItem) received.set(p.poLine.id, (received.get(p.poLine.id) ?? 0) + p.booked)
      }
      const complete = po.lines.every((l) => (received.get(l.id) ?? 0) >= l.qtyOrdered)
      const poStatus: PoStatus = complete ? 'received' : 'partially_received'
      await tx.updatePurchaseOrder(po.id, received, poStatus)
      await tx.markReceiptPosted(receipt.id, this.now(), user)

      return {
        booked: plans.reduce((n, p) => n + p.booked, 0),
        quarantined: plans.reduce(
          (n, p) => n + (p.serialised ? p.damagedSerials.length : p.damagedQty),
          0,
        ),
        unbooked: plans.reduce((n, p) => n + p.unbooked, 0),
        poStatus,
      }
    })
  }

  /** Moves a posted receipt's good units from the dock to `available` at `location`. */
  async putaway(
    receiptId: Id,
    input: { location: Id; user?: Id | null | undefined },
  ): Promise<PutawayResult> {
    return this.store.transaction(async (tx) => {
      const receipt = await tx.lockReceipt(receiptId)
      if (!receipt)
        throw new ReceivingError('receipt-not-found', `No goods receipt ${String(receiptId)}.`)
      if (receipt.status !== 'posted')
        throw new ReceivingError(
          'receipt-not-posted',
          `Post goods receipt ${receipt.number} before putting it away.`,
        )
      if (receipt.putAway)
        throw new ReceivingError(
          'receipt-already-put-away',
          `Goods receipt ${receipt.number} is already put away.`,
        )
      const target = await tx.locationWarehouse(input.location)
      if (target === null)
        throw new ReceivingError('unknown-location', `No location ${String(input.location)}.`)
      if (target !== receipt.locationWarehouse) {
        throw new ReceivingError(
          'wrong-warehouse',
          `Put-away location ${String(input.location)} is outside the warehouse goods receipt ${receipt.number} arrived at.`,
        )
      }
      const po = await tx.lockPurchaseOrder(receipt.purchaseOrder)
      if (!po)
        throw new ReceivingError(
          'receipt-not-found',
          `The purchase order of ${receipt.number} no longer exists.`,
        )
      const plans = this.plan(receipt, po, { forPutaway: true })

      const doc = { type: 'receipt' as const, id: receipt.number }
      const user = input.user ?? null
      const same = input.location === receipt.location
      const ops: LedgerOperation[] = []
      let available = 0
      const place = (sku: string, qty: number, serial?: string) => {
        available += qty
        ops.push(
          same
            ? {
                move: {
                  sku,
                  qty,
                  serial,
                  from: 'received',
                  to: 'available',
                  location: receipt.location,
                  doc,
                  user,
                },
              }
            : {
                transfer: {
                  sku,
                  qty,
                  serial,
                  from: { location: receipt.location, state: 'received' },
                  to: { location: input.location, state: 'available' },
                  doc,
                  user,
                },
              },
        )
      }
      for (const p of plans) {
        if (p.wrongItem) continue // stays in quarantine for the buyer to resolve with the supplier
        if (p.serialised) {
          for (const serial of p.line.serials)
            if (!p.damagedSerials.includes(serial)) place(p.line.sku, 1, serial)
        } else if (p.booked - p.damagedQty > 0) {
          place(p.line.sku, p.booked - p.damagedQty)
        }
      }
      await this.ledger.applyWithin(tx.ledger, ops)
      await tx.markReceiptPutAway(receipt.id, this.now(), user, input.location)
      return { available }
    })
  }

  /** Earliest expected arrival of a SKU in a market from open purchase orders, if any. */
  openPurchaseEta(sku: string, market: string): Promise<Date | null> {
    return this.store.openPurchaseEta(sku, market)
  }

  private async openPo(
    pending: Promise<PurchaseOrderRecord | null>,
    receipt: ReceiptRecord,
  ): Promise<PurchaseOrderRecord> {
    const po = await pending
    if (!po || !OPEN.includes(po.status)) {
      throw new ReceivingError(
        'po-not-open',
        `Purchase order${po ? ` ${po.number}` : ''} is ${po?.status ?? 'missing'}; only ordered or partially received orders can be received.`,
      )
    }
    if (po.warehouse !== receipt.locationWarehouse) {
      throw new ReceivingError(
        'wrong-warehouse',
        `Goods receipt ${receipt.number} is at a location outside purchase order ${po.number}'s warehouse.`,
      )
    }
    return po
  }

  /** Validates every line and works out what it books. */
  private plan(
    receipt: ReceiptRecord,
    po: PurchaseOrderRecord,
    options: { forPutaway?: boolean } = {},
  ): LinePlan[] {
    if (receipt.lines.length === 0)
      throw new ReceivingError('receipt-empty', `Goods receipt ${receipt.number} has no lines.`)
    const seen = new Set<string>()
    const bookedPerPoLine = new Map<string, number>()

    return receipt.lines.map((line, index) => {
      const n = index + 1
      const poLine = po.lines.find((l) => l.id === line.poLine)
      if (!poLine)
        throw new ReceivingError(
          'unknown-po-line',
          `Line ${n} answers no line of purchase order ${po.number}.`,
          { line: n, poLine: line.poLine },
        )
      if (!whole(line.qty) || line.qty <= 0)
        throw new ReceivingError(
          'invalid-quantity',
          `Line ${n}: quantity must be a whole number above zero.`,
          { line: n },
        )

      for (const e of line.exceptions) {
        if (!RECEIPT_EXCEPTIONS.includes(e.type))
          throw new ReceivingError(
            'invalid-exception',
            `Line ${n}: unknown exception ${String(e.type)}.`,
            { line: n },
          )
        if (e.qty !== undefined && (!whole(e.qty) || e.qty < 0 || e.qty > line.qty)) {
          throw new ReceivingError(
            'invalid-exception',
            `Line ${n}: a ${e.type} exception covers 0 to ${line.qty} units.`,
            { line: n },
          )
        }
        for (const serial of e.serials ?? []) {
          if (!line.serials.includes(serial))
            throw new ReceivingError(
              'invalid-exception',
              `Line ${n}: serial ${serial} in a ${e.type} exception was not scanned on this line.`,
              { line: n, serial },
            )
        }
      }
      const has = (type: string) => line.exceptions.some((e) => e.type === type)
      const sum = (type: string) =>
        line.exceptions.filter((e) => e.type === type).reduce((total, e) => total + (e.qty ?? 0), 0)

      const wrongItem = has('wrong_item')
      if (line.sku !== poLine.sku && !wrongItem) {
        throw new ReceivingError(
          'sku-mismatch',
          `Line ${n}: received ${line.sku} but the order line is ${poLine.sku}; record a wrong_item exception.`,
          { line: n },
        )
      }

      const serialised = wrongItem ? line.serials.length > 0 : poLine.serialised
      let booked = line.qty
      let unbooked = 0
      let damagedSerials: string[] = []
      let damagedQty = 0
      if (serialised) {
        unbooked = sum('missing_serial')
        if (line.serials.length + unbooked !== line.qty) {
          throw new ReceivingError(
            'serial-missing',
            `Line ${n} (${line.sku}) has ${line.qty} units but ${line.serials.length} serials${unbooked ? ` and ${unbooked} marked missing_serial` : ''}; scan each unit or mark it missing_serial.`,
            { line: n },
          )
        }
        for (const serial of line.serials) {
          if (!serial.trim())
            throw new ReceivingError('serial-missing', `Line ${n}: a serial is blank.`, { line: n })
          if (seen.has(serial))
            throw new ReceivingError(
              'serial-duplicate',
              `Serial ${serial} is scanned twice on this receipt.`,
              { line: n, serial },
            )
          seen.add(serial)
        }
        booked = line.serials.length
        damagedSerials = wrongItem
          ? [...line.serials]
          : [
              ...new Set(
                line.exceptions.filter((e) => e.type === 'damaged').flatMap((e) => e.serials ?? []),
              ),
            ]
      } else {
        if (line.serials.length)
          throw new ReceivingError(
            'serial-not-allowed',
            `Line ${n}: ${line.sku} is not tracked by serial.`,
            { line: n },
          )
        damagedQty = wrongItem ? line.qty : Math.min(sum('damaged'), line.qty)
      }

      if (!wrongItem && !options.forPutaway) {
        const total = poLine.qtyReceived + (bookedPerPoLine.get(poLine.id) ?? 0) + booked
        bookedPerPoLine.set(poLine.id, (bookedPerPoLine.get(poLine.id) ?? 0) + booked)
        if (total > poLine.qtyOrdered && !has('over')) {
          throw new ReceivingError(
            'over-receipt',
            `Line ${n}: ${total} of ${poLine.qtyOrdered} ${poLine.sku} would be received; record an over exception to accept the extra units.`,
            { line: n },
          )
        }
      }
      return { line, poLine, serialised, wrongItem, booked, damagedQty, damagedSerials, unbooked }
    })
  }
}
