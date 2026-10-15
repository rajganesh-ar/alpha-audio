/**
 * Stock ledger vocabulary (docs/spec, Server logic → Stock ledger).
 *
 * A quantity of a SKU is always in one state at one location. Levels are derived from
 * movements; nothing ever edits a quantity.
 */

/** Main flow `received → available → reserved → picked → shipped → delivered`, then side states. */
export const STOCK_STATES = [
  'received',
  'available',
  'reserved',
  'picked',
  'shipped',
  'delivered',
  'demo',
  'ex_display',
  'in_transit',
  'bonded',
  'damaged',
  'rma',
  'quarantine',
] as const
export type StockState = (typeof STOCK_STATES)[number]

/** Owned by the reservation flow: only reserve(), release() and pick() enter or leave them. */
export const RESERVATION_FLOW_STATES: readonly StockState[] = ['reserved', 'picked']

export const DOC_TYPES = [
  'receipt',
  'opening',
  'transfer',
  'cart',
  'quote',
  'pos',
  'project',
  'order',
  'shipment',
  'count',
  'adjustment',
  'rma',
] as const
export type DocType = (typeof DOC_TYPES)[number]

/** Documents that hold stock through a reservation. */
export const RESERVATION_DOC_TYPES = ['cart', 'quote', 'pos', 'project', 'order'] as const
export type ReservationDocType = (typeof RESERVATION_DOC_TYPES)[number]

/** Hold times from the spec. Projects carry their own expiry; paid orders do not expire. */
export const RESERVATION_TTL_MS = {
  cart: 15 * 60 * 1000,
  pos: 30 * 60 * 1000,
  quote: 7 * 24 * 60 * 60 * 1000,
} as const satisfies Partial<Record<ReservationDocType, number>>

/** `picked`, `shipped` and `delivered` follow the units through fulfilment (docs/tasks/0010). */
export const RESERVATION_STATUSES = [
  'active',
  'released',
  'expired',
  'picked',
  'shipped',
  'delivered',
] as const
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number]

/** Database ids are numbers in Postgres; the ledger does not care. */
export type Id = string | number

export interface DocRef {
  type: DocType
  id: string
}

export interface LevelKey {
  sku: string
  location: Id
  state: StockState
}

export interface Level extends LevelKey {
  qty: number
}

export interface MovementRecord {
  sku: string
  serial: string | null
  qty: number
  /** `null`: the stock enters the ledger (receipt, opening count, count gain, transfer in). */
  fromState: StockState | null
  /** `null`: the stock leaves the ledger (count loss, write-off, transfer out). */
  toState: StockState | null
  location: Id
  docType: DocType
  docId: string
  user: Id | null
  reason: string | null
  createdAt: Date
}

export interface SerialRecord {
  serial: string
  sku: string
  /** `null` once the unit has left the ledger (written off, transferred out mid-flight). */
  state: StockState | null
  location: Id | null
}

export interface ReservationRecord {
  id: Id
  sku: string
  location: Id
  qty: number
  serials: string[]
  docType: ReservationDocType
  docId: string
  status: ReservationStatus
  expiresAt: Date | null
  createdAt: Date
}

export type SkuMode = 'serial' | 'bulk' | 'new'

export function levelId(key: LevelKey): string {
  return `${key.sku}\u0000${String(key.location)}\u0000${key.state}`
}
