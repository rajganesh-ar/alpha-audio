import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres/drizzle'
import { ensureStaffUser } from '@alpha/payload'
import type { LedgerSnapshot } from '@alpha/core/testing'
import type { ReservationDocType, StockState } from '@alpha/core'

interface Db {
  execute(query: ReturnType<typeof sql>): Promise<{ rows: Array<Record<string, unknown>> }>
}
// reason: the Postgres adapter keeps its Drizzle instance on `drizzle`
export const db = (payload: Payload) => (payload.db as unknown as { drizzle: Db }).drizzle

export const staff = (payload: Payload) =>
  ensureStaffUser(payload, { email: 'ops@alpha.test', password: 'integration-password-1' })

export interface InventoryFixture {
  warehouse: number
  /** Sellable, priority 10. */
  main: number
  /** Sellable, priority 20. */
  showroom: number
  /** Not sellable. */
  demo: number
}

let sequence = 0

/** A UAE warehouse with three locations, created through the Local API as a staff user. */
export async function seedInventory(payload: Payload): Promise<InventoryFixture> {
  const user = await staff(payload)
  const n = ++sequence
  const warehouse = await payload.create({
    collection: 'warehouses',
    data: { code: `DXB-WH${n}`, name: `Dubai warehouse ${n}`, market: 'ae', type: 'warehouse' },
    user,
    overrideAccess: false,
  })
  const location = (code: string, sellable: boolean, priority: number) =>
    payload.create({
      collection: 'locations',
      data: { code, warehouse: warehouse.id, sellable, priority },
      user,
      overrideAccess: false,
    })
  const [main, showroom, demo] = await Promise.all([
    location('A01', true, 10),
    location('SHOW', true, 20),
    location('DEMO', false, 30),
  ])
  return { warehouse: warehouse.id, main: main.id, showroom: showroom.id, demo: demo.id }
}

/** Every ledger row, read straight from Postgres, for the invariant checker. */
export async function ledgerSnapshot(payload: Payload): Promise<LedgerSnapshot> {
  const run = (q: ReturnType<typeof sql>) =>
    db(payload)
      .execute(q)
      .then((r) => r.rows)
  const [movements, levels, serials, reservations] = await Promise.all([
    run(
      sql`SELECT sku, serial, qty, from_state::text AS from_state, to_state::text AS to_state, location_id, doc_type::text AS doc_type, doc_id, user_id, reason, created_at FROM stock_movements ORDER BY id`,
    ),
    run(sql`SELECT sku, location_id, state::text AS state, qty FROM stock_levels`),
    run(sql`SELECT serial, sku, current_state::text AS state, location_id FROM serial_numbers`),
    run(
      sql`SELECT id, sku, location_id, qty, serials, doc_type::text AS doc_type, doc_id, status::text AS status, expires_at, created_at FROM reservations`,
    ),
  ])
  return {
    movements: movements.map((m) => ({
      sku: String(m['sku']),
      serial: (m['serial'] as string | null) ?? null,
      qty: Number(m['qty']),
      fromState: (m['from_state'] as StockState | null) ?? null,
      toState: (m['to_state'] as StockState | null) ?? null,
      location: Number(m['location_id']),
      docType: m['doc_type'] as LedgerSnapshot['movements'][number]['docType'],
      docId: String(m['doc_id']),
      user: (m['user_id'] as number | null) ?? null,
      reason: (m['reason'] as string | null) ?? null,
      createdAt: new Date(String(m['created_at'])),
    })),
    levels: levels.map((l) => ({
      sku: String(l['sku']),
      location: Number(l['location_id']),
      state: l['state'] as StockState,
      qty: Number(l['qty']),
    })),
    serials: serials.map((s) => ({
      serial: String(s['serial']),
      sku: String(s['sku']),
      state: (s['state'] as StockState | null) ?? null,
      location: s['location_id'] === null ? null : Number(s['location_id']),
    })),
    reservations: reservations.map((r) => ({
      id: Number(r['id']),
      sku: String(r['sku']),
      location: Number(r['location_id']),
      qty: Number(r['qty']),
      serials: (r['serials'] as string[] | null) ?? [],
      docType: r['doc_type'] as ReservationDocType,
      docId: String(r['doc_id']),
      status: r['status'] as LedgerSnapshot['reservations'][number]['status'],
      expiresAt: r['expires_at'] ? new Date(String(r['expires_at'])) : null,
      createdAt: new Date(String(r['created_at'])),
    })),
  }
}
