import type { Payload } from 'payload'
import { sql, type SQL } from '@payloadcms/db-postgres/drizzle'
import {
  LedgerError,
  LedgerService,
  levelId,
  type Id,
  type Level,
  type LevelKey,
  type LedgerStore,
  type LedgerTx,
  type MovementRecord,
  type ReservationDocType,
  type ReservationRecord,
  type ReservationStatus,
  type SerialRecord,
  type SkuMode,
  type StockState,
} from '@alpha/core'

/**
 * Postgres store for the stock ledger.
 *
 * System code: it writes the ledger-owned tables directly, bypassing Payload access and hooks,
 * which refuse every write from anyone else. Each operation runs in one Drizzle transaction;
 * level rows are created if missing and then locked with `SELECT … FOR UPDATE`, always in the
 * same order (sku, location, state), so concurrent operations queue instead of overselling
 * and cannot deadlock on level rows. The database adds its own guards (migration
 * `ledger_constraints`): levels cannot go below zero and movements cannot be changed.
 */

/** Minimal surface of the Drizzle database the adapter exposes (`payload.db.drizzle`). */
interface Executor {
  execute(query: SQL): Promise<{ rows: Array<Record<string, unknown>> }>
}
interface Database extends Executor {
  transaction<T>(work: (tx: Executor) => Promise<T>): Promise<T>
}

const UNIQUE_VIOLATION = '23505'

const int = (value: unknown): number => Number(value)
const list = (values: readonly SQL[]) => sql.join([...values], sql`, `)
const sortKeys = (keys: readonly LevelKey[]) =>
  [...new Map(keys.map((k) => [levelId(k), k])).values()].sort(
    (a, b) =>
      a.sku.localeCompare(b.sku) ||
      int(a.location) - int(b.location) ||
      a.state.localeCompare(b.state),
  )

function toReservation(row: Record<string, unknown>): ReservationRecord {
  return {
    id: int(row['id']),
    sku: String(row['sku']),
    location: int(row['location_id']),
    qty: int(row['qty']),
    serials: Array.isArray(row['serials']) ? (row['serials'] as string[]) : [],
    docType: row['doc_type'] as ReservationDocType,
    docId: String(row['doc_id']),
    status: row['status'] as ReservationStatus,
    expiresAt: row['expires_at'] ? new Date(row['expires_at'] as string) : null,
    createdAt: new Date(row['created_at'] as string),
  }
}

const RESERVATION_COLUMNS = sql`id, sku, location_id, qty, serials, doc_type::text AS doc_type, doc_id, status::text AS status, expires_at, created_at`

function transactionApi(tx: Executor): LedgerTx {
  return {
    async lockLevels(keys) {
      const sorted = sortKeys(keys)
      if (sorted.length === 0) return new Map()
      await tx.execute(sql`
        INSERT INTO stock_levels (sku, location_id, state, qty, created_at, updated_at)
        VALUES ${list(sorted.map((k) => sql`(${k.sku}, ${k.location}, ${k.state}, 0, now(), now())`))}
        ON CONFLICT (sku, location_id, state) DO NOTHING`)
      const { rows } = await tx.execute(sql`
        SELECT sku, location_id, state::text AS state, qty FROM stock_levels
        WHERE (sku, location_id, state::text) IN (${list(sorted.map((k) => sql`(${k.sku}, ${k.location}::integer, ${k.state}::text)`))})
        ORDER BY sku, location_id, state::text
        FOR UPDATE`)
      return new Map(
        rows.map((r) => [
          levelId({
            sku: String(r['sku']),
            location: int(r['location_id']),
            state: r['state'] as StockState,
          }),
          int(r['qty']),
        ]),
      )
    },

    async writeLevels(levels: readonly Level[]) {
      for (const level of levels) {
        await tx.execute(sql`
          UPDATE stock_levels SET qty = ${level.qty}, updated_at = now()
          WHERE sku = ${level.sku} AND location_id = ${level.location} AND state = ${level.state}`)
      }
    },

    async insertMovements(movements: readonly MovementRecord[]) {
      if (movements.length === 0) return
      await tx.execute(sql`
        INSERT INTO stock_movements (sku, serial, qty, from_state, to_state, location_id, doc_type, doc_id, user_id, reason, created_at, updated_at)
        VALUES ${list(
          movements.map(
            (m) =>
              sql`(${m.sku}, ${m.serial}, ${m.qty}, ${m.fromState}, ${m.toState}, ${m.location}, ${m.docType}, ${m.docId}, ${m.user}, ${m.reason}, ${m.createdAt.toISOString()}, ${m.createdAt.toISOString()})`,
          ),
        )}`)
    },

    async lockSerials(serials) {
      if (serials.length === 0) return new Map()
      const { rows } = await tx.execute(sql`
        SELECT serial, sku, current_state::text AS state, location_id FROM serial_numbers
        WHERE serial IN (${list([...serials].sort().map((s) => sql`${s}`))})
        ORDER BY serial
        FOR UPDATE`)
      return new Map(
        rows.map((r) => [
          String(r['serial']),
          {
            serial: String(r['serial']),
            sku: String(r['sku']),
            state: (r['state'] as StockState | null) ?? null,
            location: r['location_id'] === null ? null : int(r['location_id']),
          },
        ]),
      )
    },

    async writeSerials(records: readonly SerialRecord[], created: ReadonlySet<string>) {
      for (const r of records) {
        if (created.has(r.serial)) {
          try {
            await tx.execute(sql`
              INSERT INTO serial_numbers (serial, sku, current_state, location_id, created_at, updated_at)
              VALUES (${r.serial}, ${r.sku}, ${r.state}, ${r.location}, now(), now())`)
          } catch (error) {
            // Another transaction booked the same new serial first; the unique index wins.
            if (
              (error as { code?: string; cause?: { code?: string } }).code === UNIQUE_VIOLATION ||
              (error as { cause?: { code?: string } }).cause?.code === UNIQUE_VIOLATION
            ) {
              throw new LedgerError(
                'serial-duplicate',
                `Serial ${r.serial} is already in the ledger.`,
              )
            }
            throw error
          }
        } else {
          await tx.execute(sql`
            UPDATE serial_numbers SET sku = ${r.sku}, current_state = ${r.state}, location_id = ${r.location}, updated_at = now()
            WHERE serial = ${r.serial}`)
        }
      }
    },

    async serialsAt(sku, location, state, limit) {
      const { rows } = await tx.execute(sql`
        SELECT serial FROM serial_numbers
        WHERE sku = ${sku} AND location_id = ${location} AND current_state = ${state}
        ORDER BY serial
        LIMIT ${Math.min(limit, 1_000_000)}
        FOR UPDATE`)
      return rows.map((r) => String(r['serial']))
    },

    async skuMode(sku): Promise<SkuMode> {
      const { rows } = await tx.execute(sql`
        SELECT
          EXISTS (SELECT 1 FROM stock_movements WHERE sku = ${sku} AND serial IS NOT NULL) AS serial,
          EXISTS (SELECT 1 FROM stock_movements WHERE sku = ${sku} AND serial IS NULL) AS bulk`)
      const row = rows[0] ?? {}
      return row['serial'] ? 'serial' : row['bulk'] ? 'bulk' : 'new'
    },

    async insertReservation(r) {
      const { rows } = await tx.execute(sql`
        INSERT INTO reservations (sku, location_id, qty, serials, doc_type, doc_id, status, expires_at, created_at, updated_at)
        VALUES (${r.sku}, ${r.location}, ${r.qty}, ${JSON.stringify(r.serials)}::jsonb, ${r.docType}, ${r.docId}, ${r.status},
                ${r.expiresAt ? r.expiresAt.toISOString() : null}, ${r.createdAt.toISOString()}, now())
        RETURNING ${RESERVATION_COLUMNS}`)
      return toReservation(rows[0] ?? {})
    },

    async lockReservation(id: Id) {
      const { rows } = await tx.execute(
        sql`SELECT ${RESERVATION_COLUMNS} FROM reservations WHERE id = ${int(id)} FOR UPDATE`,
      )
      return rows[0] ? toReservation(rows[0]) : null
    },

    async setReservationStatus(id: Id, status: ReservationStatus) {
      await tx.execute(
        sql`UPDATE reservations SET status = ${status}, updated_at = now() WHERE id = ${int(id)}`,
      )
    },

    async lockExpiredReservations(now: Date, limit: number) {
      const { rows } = await tx.execute(sql`
        SELECT ${RESERVATION_COLUMNS} FROM reservations
        WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at <= ${now.toISOString()}
        ORDER BY expires_at, id
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED`)
      return rows.map(toReservation)
    },
  }
}

export class PostgresLedgerStore implements LedgerStore {
  constructor(private readonly db: Database) {}

  transaction<T>(work: (tx: LedgerTx) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => work(transactionApi(tx)))
  }

  async fulfilmentLocations(market: string): Promise<Id[]> {
    const { rows } = await this.db.execute(sql`
      SELECT l.id FROM locations l JOIN warehouses w ON w.id = l.warehouse_id
      WHERE w.market = ${market} AND l.sellable AND l.active AND w.active
      ORDER BY l.priority, l.id`)
    return rows.map((r) => int(r['id']))
  }

  async sumLevels(sku: string, locations: readonly Id[], state: StockState): Promise<number> {
    const { rows } = await this.db.execute(sql`
      SELECT COALESCE(SUM(qty), 0) AS qty FROM stock_levels
      WHERE sku = ${sku} AND state = ${state} AND location_id IN (${list(locations.map((l) => sql`${int(l)}`))})`)
    return int(rows[0]?.['qty'] ?? 0)
  }
}

/** The stock ledger for this Payload instance. `now` is injectable for tests. */
export function createLedger(payload: Payload, now?: () => Date): LedgerService {
  // reason: the Postgres adapter's Drizzle instance; only execute() and transaction() are used
  const db = (payload.db as unknown as { drizzle: Database }).drizzle
  return new LedgerService(new PostgresLedgerStore(db), now)
}
