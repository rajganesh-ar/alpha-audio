import type { Payload } from 'payload'
import { sql, type SQL } from '@payloadcms/db-postgres/drizzle'
import {
  ReceivingService,
  type Id,
  type PoStatus,
  type PurchaseOrderRecord,
  type PurchasingStore,
  type PurchasingTx,
  type ReceiptException,
  type ReceiptRecord,
} from '@alpha/core'
import {
  createLedger,
  drizzleOf,
  transactionApi,
  type Database,
  type Executor,
} from './ledgerStore'

/**
 * Postgres store for receiving (docs/tasks/0005).
 *
 * System code: posting writes `goods_receipts.status`, the PO's received quantities and status,
 * and the ledger in one Drizzle transaction, bypassing Payload access (those fields are
 * system-written; nobody can type them). The receipt row is locked first with
 * `SELECT … FOR UPDATE`, so a second post of the same receipt waits and then sees it posted.
 * The PO row is locked next, so two receipts against one PO update it one after the other.
 */

const int = (value: unknown): number => Number(value)
const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
const list = (values: readonly SQL[]) => sql.join([...values], sql`, `)

async function lockReceipt(tx: Executor, id: Id): Promise<ReceiptRecord | null> {
  const { rows } = await tx.execute(sql`
    SELECT r.id, r.number, r.purchase_order_id, r.location_id, loc.warehouse_id, r.status::text AS status, r.putaway_at
    FROM goods_receipts r JOIN locations loc ON loc.id = r.location_id
    WHERE r.id = ${int(id)} FOR UPDATE OF r`)
  const row = rows[0]
  if (!row) return null
  const { rows: lines } = await tx.execute(sql`
    SELECT id, po_line, sku, qty, serials FROM goods_receipts_lines
    WHERE _parent_id = ${int(id)} ORDER BY _order`)
  const { rows: exceptions } = lines.length
    ? await tx.execute(sql`
        SELECT _parent_id, type::text AS type, qty, serials, note FROM goods_receipts_lines_exceptions
        WHERE _parent_id IN (${list(lines.map((l) => sql`${String(l['id'])}`))}) ORDER BY _parent_id, _order`)
    : { rows: [] }
  return {
    id: int(row['id']),
    number: String(row['number']),
    purchaseOrder: int(row['purchase_order_id']),
    location: int(row['location_id']),
    locationWarehouse: int(row['warehouse_id']),
    status: row['status'] as ReceiptRecord['status'],
    putAway: row['putaway_at'] !== null,
    lines: lines.map((l) => ({
      poLine: String(l['po_line']),
      sku: String(l['sku']),
      qty: int(l['qty']),
      serials: stringList(l['serials']),
      exceptions: exceptions
        .filter((e) => e['_parent_id'] === l['id'])
        .map((e): ReceiptException => {
          const exception: ReceiptException = { type: e['type'] as ReceiptException['type'] }
          if (e['qty'] !== null) exception.qty = int(e['qty'])
          if (e['serials'] !== null) exception.serials = stringList(e['serials'])
          if (e['note'] !== null) exception.note = String(e['note'])
          return exception
        }),
    })),
  }
}

async function lockPurchaseOrder(tx: Executor, id: Id): Promise<PurchaseOrderRecord | null> {
  const { rows } = await tx.execute(sql`
    SELECT id, number, warehouse_id, status::text AS status, expected_at
    FROM purchase_orders WHERE id = ${int(id)} FOR UPDATE`)
  const row = rows[0]
  if (!row) return null
  const { rows: lines } = await tx.execute(sql`
    SELECT id, sku, qty_ordered, qty_received, serialised FROM purchase_orders_lines
    WHERE _parent_id = ${int(id)} ORDER BY _order FOR UPDATE`)
  return {
    id: int(row['id']),
    number: String(row['number']),
    warehouse: int(row['warehouse_id']),
    status: row['status'] as PoStatus,
    expectedAt: row['expected_at'] ? new Date(row['expected_at'] as string) : null,
    lines: lines.map((l) => ({
      id: String(l['id']),
      sku: String(l['sku']),
      qtyOrdered: int(l['qty_ordered']),
      qtyReceived: int(l['qty_received'] ?? 0),
      serialised: l['serialised'] === true,
    })),
  }
}

function purchasingTx(tx: Executor): PurchasingTx {
  return {
    ledger: transactionApi(tx),
    lockReceipt: (id) => lockReceipt(tx, id),
    lockPurchaseOrder: (id) => lockPurchaseOrder(tx, id),

    async locationWarehouse(id) {
      const { rows } = await tx.execute(
        sql`SELECT warehouse_id FROM locations WHERE id = ${int(id)}`,
      )
      return rows[0] ? int(rows[0]['warehouse_id']) : null
    },

    async markReceiptPosted(id, at, user) {
      await tx.execute(sql`
        UPDATE goods_receipts SET status = 'posted', posted_at = ${at.toISOString()},
          posted_by_id = ${user === null ? null : int(user)}, updated_at = now()
        WHERE id = ${int(id)}`)
    },

    async markReceiptPutAway(id, at, _user, location) {
      await tx.execute(sql`
        UPDATE goods_receipts SET putaway_at = ${at.toISOString()}, putaway_location_id = ${int(location)}, updated_at = now()
        WHERE id = ${int(id)}`)
    },

    async updatePurchaseOrder(id, received, status) {
      for (const [line, qty] of received) {
        await tx.execute(sql`
          UPDATE purchase_orders_lines SET qty_received = ${qty} WHERE id = ${line} AND _parent_id = ${int(id)}`)
      }
      await tx.execute(
        sql`UPDATE purchase_orders SET status = ${status}, updated_at = now() WHERE id = ${int(id)}`,
      )
    },
  }
}

export class PostgresPurchasingStore implements PurchasingStore {
  constructor(private readonly db: Database) {}

  transaction<T>(work: (tx: PurchasingTx) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => work(purchasingTx(tx)))
  }

  async openPurchaseEta(sku: string, market: string): Promise<Date | null> {
    const { rows } = await this.db.execute(sql`
      SELECT MIN(po.expected_at) AS eta
      FROM purchase_orders po
      JOIN purchase_orders_lines l ON l._parent_id = po.id
      JOIN warehouses w ON w.id = po.warehouse_id
      WHERE l.sku = ${sku} AND w.market = ${market}
        AND po.status IN ('ordered', 'partially_received')
        AND po.expected_at IS NOT NULL
        AND l.qty_ordered > COALESCE(l.qty_received, 0)`)
    const eta = rows[0]?.['eta']
    return eta ? new Date(eta as string) : null
  }
}

/** Receiving for this Payload instance, sharing transactions with the stock ledger. */
export function createReceiving(payload: Payload, now?: () => Date): ReceivingService {
  return new ReceivingService(
    new PostgresPurchasingStore(drizzleOf(payload)),
    createLedger(payload, now),
    now,
  )
}
