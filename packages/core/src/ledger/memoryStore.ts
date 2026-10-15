import type { LedgerStore, LedgerTx } from './store'
import {
  levelId,
  type Id,
  type Level,
  type LevelKey,
  type MovementRecord,
  type ReservationRecord,
  type ReservationStatus,
  type SerialRecord,
  type SkuMode,
  type StockState,
} from './types'

export interface MemoryLocation {
  id: Id
  market: string
  /** Part of the market's fulfilment set (its `available` stock is sellable). */
  sellable: boolean
}

interface State {
  levels: Map<string, Level>
  movements: MovementRecord[]
  serials: Map<string, SerialRecord>
  reservations: Map<string, ReservationRecord>
  nextId: number
}

/**
 * In-memory ledger store for unit tests and fixtures. Transactions run one at a time and roll
 * back on error, which is the isolation the Postgres store gets from row locks.
 */
export class MemoryLedgerStore implements LedgerStore {
  private state: State = {
    levels: new Map(),
    movements: [],
    serials: new Map(),
    reservations: new Map(),
    nextId: 1,
  }
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly locations: readonly MemoryLocation[] = []) {}

  transaction<T>(work: (tx: LedgerTx) => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const snapshot = clone(this.state)
      try {
        return await work(this.tx())
      } catch (error) {
        this.state = snapshot
        throw error
      }
    })
    this.queue = run.catch(() => undefined)
    return run
  }

  async fulfilmentLocations(market: string): Promise<Id[]> {
    return this.locations.filter((l) => l.market === market && l.sellable).map((l) => l.id)
  }

  async sumLevels(sku: string, locations: readonly Id[], state: StockState): Promise<number> {
    return locations.reduce<number>(
      (sum, location) => sum + (this.state.levels.get(levelId({ sku, location, state }))?.qty ?? 0),
      0,
    )
  }

  // Read-only views for tests.
  get levels(): readonly Level[] {
    return [...this.state.levels.values()]
  }
  get movements(): readonly MovementRecord[] {
    return this.state.movements
  }
  get serials(): readonly SerialRecord[] {
    return [...this.state.serials.values()]
  }
  get reservations(): readonly ReservationRecord[] {
    return [...this.state.reservations.values()]
  }

  private tx(): LedgerTx {
    const s = this.state
    return {
      lockLevels: async (keys: readonly LevelKey[]) => {
        const out = new Map<string, number>()
        for (const key of keys) {
          const id = levelId(key)
          if (!s.levels.has(id)) s.levels.set(id, { ...key, qty: 0 })
          out.set(id, s.levels.get(id)?.qty ?? 0)
        }
        return out
      },
      writeLevels: async (levels) => {
        for (const level of levels) s.levels.set(levelId(level), { ...level })
      },
      insertMovements: async (movements) => {
        s.movements.push(...movements.map((m) => ({ ...m })))
      },
      lockSerials: async (serials) =>
        new Map(
          serials.flatMap((serial) => {
            const record = s.serials.get(serial)
            return record ? [[serial, { ...record }] as const] : []
          }),
        ),
      writeSerials: async (records, created) => {
        for (const record of records) {
          if (created.has(record.serial) && s.serials.has(record.serial))
            throw new Error(`duplicate serial ${record.serial}`)
          s.serials.set(record.serial, { ...record })
        }
      },
      serialsAt: async (sku, location, state, limit) =>
        [...s.serials.values()]
          .filter((r) => r.sku === sku && r.location === location && r.state === state)
          .map((r) => r.serial)
          .sort()
          .slice(0, limit),
      skuMode: async (sku): Promise<SkuMode> => {
        const moves = s.movements.filter((m) => m.sku === sku)
        if (moves.length === 0) return 'new'
        return moves.some((m) => m.serial !== null) ? 'serial' : 'bulk'
      },
      insertReservation: async (reservation) => {
        const record: ReservationRecord = {
          ...reservation,
          serials: [...reservation.serials],
          id: s.nextId++,
        }
        s.reservations.set(String(record.id), record)
        return { ...record }
      },
      lockReservation: async (id) => {
        const record = s.reservations.get(String(id))
        return record ? { ...record, serials: [...record.serials] } : null
      },
      setReservationStatus: async (id, status: ReservationStatus) => {
        const record = s.reservations.get(String(id))
        if (record) record.status = status
      },
      retargetReservation: async (id, docType, docId, expiresAt) => {
        const record = s.reservations.get(String(id))
        if (record) Object.assign(record, { docType, docId, expiresAt })
      },
      lockExpiredReservations: async (now, limit) =>
        [...s.reservations.values()]
          .filter((r) => r.status === 'active' && r.expiresAt !== null && r.expiresAt <= now)
          .slice(0, limit)
          .map((r) => ({ ...r, serials: [...r.serials] })),
    }
  }
}

function clone(state: State): State {
  return {
    levels: new Map([...state.levels].map(([k, v]) => [k, { ...v }])),
    movements: state.movements.map((m) => ({ ...m })),
    serials: new Map([...state.serials].map(([k, v]) => [k, { ...v }])),
    reservations: new Map(
      [...state.reservations].map(([k, v]) => [k, { ...v, serials: [...v.serials] }]),
    ),
    nextId: state.nextId,
  }
}
