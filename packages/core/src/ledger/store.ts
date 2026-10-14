import type {
  Id,
  Level,
  LevelKey,
  MovementRecord,
  ReservationRecord,
  ReservationStatus,
  SerialRecord,
  SkuMode,
  StockState,
} from './types'

/**
 * Work done inside one ledger transaction. The Postgres implementation locks rows with
 * `SELECT … FOR UPDATE`; anything read through `lock*` stays locked until commit.
 */
export interface LedgerTx {
  /** Locks the level rows (creating zero rows that do not exist yet) and returns their quantities by `levelId`. */
  lockLevels(keys: readonly LevelKey[]): Promise<Map<string, number>>
  writeLevels(levels: readonly Level[]): Promise<void>
  insertMovements(movements: readonly MovementRecord[]): Promise<void>
  /** Locks the serial rows that exist; missing serials are absent from the map. */
  lockSerials(serials: readonly string[]): Promise<Map<string, SerialRecord>>
  /** Inserts new serials and updates known ones. A duplicate insert must fail. */
  writeSerials(serials: readonly SerialRecord[], created: ReadonlySet<string>): Promise<void>
  /** Serial numbers of a SKU in a state at a location, oldest first. Call with that level locked. */
  serialsAt(sku: string, location: Id, state: StockState, limit: number): Promise<string[]>
  /** Whether the SKU has moved with serials, without, or never. */
  skuMode(sku: string): Promise<SkuMode>
  insertReservation(reservation: Omit<ReservationRecord, 'id'>): Promise<ReservationRecord>
  lockReservation(id: Id): Promise<ReservationRecord | null>
  setReservationStatus(id: Id, status: ReservationStatus): Promise<void>
  /** Active reservations past expiry, locked; rows locked by another worker are skipped. */
  lockExpiredReservations(now: Date, limit: number): Promise<ReservationRecord[]>
}

export interface LedgerStore {
  /** Runs `work` in one transaction: all of it commits, or none of it. */
  transaction<T>(work: (tx: LedgerTx) => Promise<T>): Promise<T>
  /** Locations whose `available` stock a market can sell, in allocation order. */
  fulfilmentLocations(market: string): Promise<Id[]>
  /** Sum of a state's quantity across locations (a plain read; no lock). */
  sumLevels(sku: string, locations: readonly Id[], state: StockState): Promise<number>
}
