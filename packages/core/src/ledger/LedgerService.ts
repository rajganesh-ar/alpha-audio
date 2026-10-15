import { LedgerError } from './errors'
import type { LedgerStore, LedgerTx } from './store'
import {
  RESERVATION_FLOW_STATES,
  RESERVATION_TTL_MS,
  levelId,
  type DocRef,
  type DocType,
  type Id,
  type Level,
  type LevelKey,
  type MovementRecord,
  type ReservationDocType,
  type ReservationRecord,
  type ReservationStatus,
  type SerialRecord,
  type StockState,
} from './types'

/** Who asked for the change; `null` for jobs and system processes. */
export interface Actor {
  user?: Id | null | undefined
}

export interface MoveInput extends Actor {
  sku: string
  qty: number
  /** Serialised SKUs move one serial per movement. */
  serial?: string | undefined
  from: StockState | null
  to: StockState | null
  location: Id
  doc: DocRef
  reason?: string | undefined
}

export interface TransferInput extends Actor {
  sku: string
  qty: number
  serial?: string | undefined
  from: { location: Id; state: StockState }
  to: { location: Id; state: StockState }
  doc: DocRef
  reason?: string | undefined
}

/** One entry for applyWithin(): a move at one location or a transfer between two. */
export type LedgerOperation = { move: MoveInput } | { transfer: TransferInput }

export interface ReserveInput extends Actor {
  sku: string
  qty: number
  /** Reserve at this location, or at the first of the market's fulfilment locations that has enough. */
  location?: Id | undefined
  market?: string | undefined
  doc: { type: ReservationDocType; id: string }
  /** Overrides the hold time for the document type. Required for projects. */
  expiresAt?: Date | null | undefined
}

export type ReserveResult =
  | { ok: true; reservation: ReservationRecord }
  | { ok: false; reason: 'insufficient-stock'; available: number }

export interface ShipInput extends Actor {
  sku: string
  qty: number
  serial?: string | undefined
  location: Id
  doc: DocRef
}

export interface CountInput extends Actor {
  sku: string
  location: Id
  /** The state the count sheet covers; `available` unless counting demo stock, damaged stock and so on. */
  state?: StockState | undefined
  /** Bulk SKUs: units counted. */
  counted?: number | undefined
  /** Serialised SKUs: serial numbers found. */
  countedSerials?: readonly string[] | undefined
  /** Mandatory for any variance. */
  reason: string
  countId: string
}

export interface CountResult {
  /** Counted minus booked; positive is a gain. */
  variance: number
  movements: number
}

/** What a movement does, before validation. */
interface Step {
  sku: string
  serial: string | null
  qty: number
  from: StockState | null
  to: StockState | null
  location: Id
  doc: DocRef
  user: Id | null
  reason: string | null
}

/** Documents that may bring stock into the ledger (`from = null`) or take it out (`to = null`). */
const MAY_ENTER: ReadonlySet<DocType> = new Set(['receipt', 'opening', 'count', 'transfer', 'rma'])
const MAY_LEAVE: ReadonlySet<DocType> = new Set(['count', 'adjustment', 'transfer'])
const NEEDS_REASON: ReadonlySet<DocType> = new Set(['count', 'adjustment'])

const isFlowState = (state: StockState | null) =>
  state !== null && RESERVATION_FLOW_STATES.includes(state)
const blank = (text: string | null | undefined) => !text || !text.trim()

/**
 * The stock ledger (docs/spec, Server logic). Every operation is one transaction: it locks
 * the level rows it touches, checks the rules, writes the movements and the new levels. A
 * refused operation throws `LedgerError` and writes nothing.
 */
export class LedgerService {
  constructor(
    private readonly store: LedgerStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** A change of state at one location (receipt, putaway, demo, damage, RMA, write-off…). */
  async move(input: MoveInput): Promise<void> {
    const steps = this.moveSteps(input)
    await this.store.transaction((tx) => this.apply(tx, steps))
  }

  /** Moves stock between locations: out of one and into the other, atomically. */
  async transfer(input: TransferInput): Promise<void> {
    const steps = this.transferSteps(input)
    await this.store.transaction((tx) => this.apply(tx, steps))
  }

  /**
   * Applies moves and transfers inside a transaction the caller already holds, with the same
   * rules as move() and transfer(). For documents that must post together with their stock,
   * such as a goods receipt: the document and its movements commit or roll back as one.
   */
  async applyWithin(tx: LedgerTx, operations: readonly LedgerOperation[]): Promise<void> {
    const steps = operations.flatMap((op) =>
      'transfer' in op ? this.transferSteps(op.transfer) : this.moveSteps(op.move),
    )
    if (steps.length) await this.apply(tx, steps)
  }

  private moveSteps(input: MoveInput): Step[] {
    if (isFlowState(input.from) || isFlowState(input.to)) {
      throw new LedgerError(
        'invalid-move',
        'Reserved and picked stock moves only through reserve(), release() and pick().',
      )
    }
    return [this.step(input)]
  }

  private transferSteps(input: TransferInput): Step[] {
    if (isFlowState(input.from.state) || isFlowState(input.to.state)) {
      throw new LedgerError('invalid-move', 'Reserved and picked stock cannot be transferred.')
    }
    if (input.from.location === input.to.location) {
      throw new LedgerError(
        'invalid-move',
        'A transfer needs two different locations; use move() within one.',
      )
    }
    const doc = { ...input.doc, type: 'transfer' as const }
    return [
      this.step({ ...input, doc, from: input.from.state, to: null, location: input.from.location }),
      this.step({ ...input, doc, from: null, to: input.to.state, location: input.to.location }),
    ]
  }

  /**
   * Holds stock for a document: `available → reserved`. Exactly the requested quantity at one
   * location, or nothing. Concurrent calls on the same SKU queue on the level row's lock, so
   * they can never reserve more than is available.
   */
  async reserve(input: ReserveInput): Promise<ReserveResult> {
    assertQuantity(input.qty)
    const expiresAt = this.expiry(input.doc.type, input.expiresAt)
    const candidates =
      input.location !== undefined
        ? [input.location]
        : input.market
          ? await this.store.fulfilmentLocations(input.market)
          : []
    if (candidates.length === 0) return { ok: false, reason: 'insufficient-stock', available: 0 }

    return this.store.transaction(async (tx) => {
      const keys = candidates.map((location) => ({
        sku: input.sku,
        location,
        state: 'available' as const,
      }))
      // Available and reserved rows in one sorted call: every operation takes level locks in the
      // same global order, so reserve and release can never deadlock each other.
      const levels = await tx.lockLevels([
        ...keys,
        ...candidates.map((location) => ({ sku: input.sku, location, state: 'reserved' as const })),
      ])
      const location = candidates.find(
        (l) =>
          (levels.get(levelId({ sku: input.sku, location: l, state: 'available' })) ?? 0) >=
          input.qty,
      )
      if (location === undefined) {
        const available = keys.reduce((sum, k) => sum + (levels.get(levelId(k)) ?? 0), 0)
        return { ok: false, reason: 'insufficient-stock', available }
      }

      const serials =
        (await tx.skuMode(input.sku)) === 'serial'
          ? await tx.serialsAt(input.sku, location, 'available', input.qty)
          : []
      const doc = { type: input.doc.type, id: input.doc.id }
      await this.apply(
        tx,
        this.unitSteps({ ...input, doc, serials, from: 'available', to: 'reserved', location }),
        levels,
      )
      const reservation = await tx.insertReservation({
        sku: input.sku,
        location,
        qty: input.qty,
        serials,
        docType: input.doc.type,
        docId: input.doc.id,
        status: 'active',
        expiresAt,
        createdAt: this.now(),
      })
      return { ok: true, reservation }
    })
  }

  /** Gives reserved stock back: `reserved → available`. */
  async release(reservationId: Id, actor: Actor & { reason?: string } = {}): Promise<void> {
    await this.store.transaction((tx) => this.releaseIn(tx, reservationId, 'released', actor))
  }

  /**
   * Moves an active reservation to another document without moving stock: a paid cart hold
   * becomes an order hold (docs/tasks/0009). Refuses a hold whose expiry has passed, even if the
   * expiry job has not run yet, so a late payment cannot keep stock it no longer holds.
   */
  async confirm(
    reservationId: Id,
    input: { doc: { type: ReservationDocType; id: string }; expiresAt?: Date | null | undefined },
  ): Promise<ReservationRecord> {
    return this.store.transaction(async (tx) => {
      const reservation = await this.activeReservation(tx, reservationId)
      if (reservation.expiresAt && reservation.expiresAt <= this.now()) {
        throw new LedgerError(
          'reservation-expired',
          `Reservation ${String(reservationId)} expired at ${reservation.expiresAt.toISOString()}.`,
        )
      }
      const expiresAt = this.expiry(input.doc.type, input.expiresAt)
      await tx.retargetReservation(reservation.id, input.doc.type, input.doc.id, expiresAt)
      return { ...reservation, docType: input.doc.type, docId: input.doc.id, expiresAt }
    })
  }

  /** A picker took the reserved units: `reserved → picked`. */
  async pick(reservationId: Id, actor: Actor = {}): Promise<void> {
    await this.store.transaction(async (tx) => {
      const reservation = await this.activeReservation(tx, reservationId)
      await this.apply(tx, this.reservationSteps(reservation, 'reserved', 'picked', actor))
      await tx.setReservationStatus(reservation.id, 'picked')
    })
  }

  /**
   * A picked reservation goes back on the shelf: `picked → available`, status `released`. For
   * an order cancelled after picking (docs/tasks/0010).
   */
  async returnToStock(reservationId: Id, actor: Actor & { reason?: string } = {}): Promise<void> {
    await this.store.transaction(async (tx) => {
      const reservation = await this.reservationIn(tx, reservationId, 'picked')
      await this.apply(tx, this.reservationSteps(reservation, 'picked', 'available', actor))
      await tx.setReservationStatus(reservation.id, 'released')
    })
  }

  /**
   * Hands a picked reservation to the courier: `picked → shipped` for exactly its units and
   * serials, recorded against the shipment; status `shipped`, so it cannot ship twice.
   */
  async shipReservation(
    reservationId: Id,
    input: Actor & { doc: { type: 'shipment'; id: string } },
  ): Promise<void> {
    await this.store.transaction(async (tx) => {
      const reservation = await this.reservationIn(tx, reservationId, 'picked')
      await this.apply(
        tx,
        this.reservationSteps(reservation, 'picked', 'shipped', input, input.doc),
      )
      await tx.setReservationStatus(reservation.id, 'shipped')
    })
  }

  /** The customer has a shipped reservation: `shipped → delivered`, status `delivered`. */
  async deliverReservation(
    reservationId: Id,
    input: Actor & { doc: { type: 'shipment'; id: string } },
  ): Promise<void> {
    await this.store.transaction(async (tx) => {
      const reservation = await this.reservationIn(tx, reservationId, 'shipped')
      await this.apply(
        tx,
        this.reservationSteps(reservation, 'shipped', 'delivered', input, input.doc),
      )
      await tx.setReservationStatus(reservation.id, 'delivered')
    })
  }

  /** The reservation as it stands (any status), for callers that resume interrupted work. */
  async reservation(reservationId: Id): Promise<ReservationRecord | null> {
    return this.store.transaction((tx) => tx.lockReservation(reservationId))
  }

  /** Handed to the courier: `picked → shipped`. */
  async ship(input: ShipInput): Promise<void> {
    await this.store.transaction((tx) =>
      this.apply(tx, [this.step({ ...input, from: 'picked', to: 'shipped' })]),
    )
  }

  /** The customer has it: `shipped → delivered`. */
  async deliver(input: ShipInput): Promise<void> {
    await this.store.transaction((tx) =>
      this.apply(tx, [this.step({ ...input, from: 'shipped', to: 'delivered' })]),
    )
  }

  /**
   * Posts a count variance. Nobody edits a quantity: the difference between the count and the
   * book becomes movements with `docType = count` and the mandatory reason.
   */
  async adjustFromCount(input: CountInput): Promise<CountResult> {
    if (blank(input.reason))
      throw new LedgerError('reason-required', 'A count variance needs a reason.')
    const state = input.state ?? 'available'
    if (isFlowState(state))
      throw new LedgerError(
        'invalid-move',
        'Reserved and picked stock is counted through its documents.',
      )
    const doc: DocRef = { type: 'count', id: input.countId }
    const base = { sku: input.sku, doc, user: input.user ?? null, reason: input.reason.trim() }
    const key: LevelKey = { sku: input.sku, location: input.location, state }

    return this.store.transaction(async (tx) => {
      const levels = await tx.lockLevels([key])
      const booked = levels.get(levelId(key)) ?? 0

      if (input.countedSerials !== undefined) {
        const found = new Set(input.countedSerials)
        const onBook = new Set(
          await tx.serialsAt(input.sku, input.location, state, Number.MAX_SAFE_INTEGER),
        )
        const records = await tx.lockSerials([...found])
        const steps: Step[] = []
        for (const serial of onBook) {
          if (!found.has(serial))
            steps.push({ ...base, serial, qty: 1, from: state, to: null, location: input.location })
        }
        for (const serial of found) {
          if (onBook.has(serial)) continue
          const known = records.get(serial)
          // Found here but booked elsewhere: take it off its old place, then book it here.
          if (known?.state && known.location !== null) {
            steps.push({
              ...base,
              serial,
              qty: 1,
              from: known.state,
              to: null,
              location: known.location,
            })
          }
          steps.push({ ...base, serial, qty: 1, from: null, to: state, location: input.location })
        }
        if (steps.length) await this.apply(tx, steps, levels)
        return { variance: found.size - onBook.size, movements: steps.length }
      }

      const counted = input.counted ?? 0
      if (!Number.isSafeInteger(counted) || counted < 0) {
        throw new LedgerError(
          'invalid-quantity',
          'A count is a whole number of units, zero or more.',
        )
      }
      const variance = counted - booked
      if (variance === 0) return { variance, movements: 0 }
      const step: Step =
        variance > 0
          ? {
              ...base,
              serial: null,
              qty: variance,
              from: null,
              to: state,
              location: input.location,
            }
          : {
              ...base,
              serial: null,
              qty: -variance,
              from: state,
              to: null,
              location: input.location,
            }
      await this.apply(tx, [step], levels)
      return { variance, movements: 1 }
    })
  }

  /** Sellable quantity in a market: `available` across the market's fulfilment locations. */
  async sellable(sku: string, market: string): Promise<number> {
    const locations = await this.store.fulfilmentLocations(market)
    return locations.length ? this.store.sumLevels(sku, locations, 'available') : 0
  }

  /**
   * Returns expired holds to `available`. Safe to run from several workers at once: each
   * batch skips reservations another worker has locked.
   */
  async releaseExpiredReservations(batchSize = 100): Promise<number> {
    let released = 0
    for (;;) {
      const batch = await this.store.transaction(async (tx) => {
        const expired = await tx.lockExpiredReservations(this.now(), batchSize)
        for (const reservation of expired) {
          await this.apply(tx, this.reservationSteps(reservation, 'reserved', 'available', {}))
          await tx.setReservationStatus(reservation.id, 'expired')
        }
        return expired.length
      })
      released += batch
      if (batch < batchSize) return released
    }
  }

  // ── internals ──────────────────────────────────────────────────────────────────────────

  private expiry(type: ReservationDocType, explicit: Date | null | undefined): Date | null {
    if (explicit !== undefined) return explicit
    if (type === 'project')
      throw new LedgerError('expiry-required', 'A project allocation needs its own expiry date.')
    if (type === 'order') return null
    return new Date(this.now().getTime() + RESERVATION_TTL_MS[type])
  }

  private async releaseIn(
    tx: LedgerTx,
    id: Id,
    status: ReservationStatus,
    actor: Actor & { reason?: string },
  ) {
    const reservation = await this.activeReservation(tx, id)
    await this.apply(tx, this.reservationSteps(reservation, 'reserved', 'available', actor))
    await tx.setReservationStatus(reservation.id, status)
  }

  private async reservationIn(
    tx: LedgerTx,
    id: Id,
    status: ReservationStatus,
  ): Promise<ReservationRecord> {
    const reservation = await tx.lockReservation(id)
    if (!reservation)
      throw new LedgerError('reservation-not-found', `No reservation ${String(id)}.`)
    if (reservation.status !== status) {
      throw new LedgerError(
        'reservation-wrong-status',
        `Reservation ${String(id)} is ${reservation.status}, not ${status}.`,
      )
    }
    return reservation
  }

  private async activeReservation(tx: LedgerTx, id: Id): Promise<ReservationRecord> {
    const reservation = await tx.lockReservation(id)
    if (!reservation)
      throw new LedgerError('reservation-not-found', `No reservation ${String(id)}.`)
    if (reservation.status !== 'active') {
      throw new LedgerError(
        'reservation-not-active',
        `Reservation ${String(id)} is ${reservation.status}.`,
      )
    }
    return reservation
  }

  private reservationSteps(
    r: ReservationRecord,
    from: StockState,
    to: StockState,
    actor: Actor & { reason?: string },
    doc: DocRef = { type: r.docType, id: r.docId },
  ): Step[] {
    return this.unitSteps({
      sku: r.sku,
      qty: r.qty,
      serials: r.serials,
      from,
      to,
      location: r.location,
      doc,
      user: actor.user,
      reason: actor.reason,
    })
  }

  /** One step for bulk stock, or one per serial. */
  private unitSteps(input: Omit<MoveInput, 'serial'> & { serials: readonly string[] }): Step[] {
    if (input.serials.length === 0) return [this.step(input)]
    return input.serials.map((serial) => this.step({ ...input, serial, qty: 1 }))
  }

  private step(input: MoveInput): Step {
    return {
      sku: input.sku,
      serial: input.serial ?? null,
      qty: input.qty,
      from: input.from,
      to: input.to,
      location: input.location,
      doc: input.doc,
      user: input.user ?? null,
      reason: blank(input.reason) ? null : (input.reason?.trim() ?? null),
    }
  }

  /**
   * The engine behind every operation: validate, lock, check, write. `locked` passes levels
   * the caller already holds (locking twice is harmless, but saves a round trip).
   */
  private async apply(
    tx: LedgerTx,
    steps: readonly Step[],
    locked?: Map<string, number>,
  ): Promise<void> {
    for (const step of steps) validate(step)

    const keys = new Map<string, LevelKey>()
    for (const s of steps) {
      if (s.from)
        keys.set(levelId({ sku: s.sku, location: s.location, state: s.from }), {
          sku: s.sku,
          location: s.location,
          state: s.from,
        })
      if (s.to)
        keys.set(levelId({ sku: s.sku, location: s.location, state: s.to }), {
          sku: s.sku,
          location: s.location,
          state: s.to,
        })
    }
    const missing = [...keys.entries()].filter(([id]) => !locked?.has(id)).map(([, k]) => k)
    const levels = new Map(locked)
    for (const [id, qty] of missing.length ? await tx.lockLevels(missing) : []) levels.set(id, qty)

    await this.checkSkuModes(tx, steps)
    const serials = await this.checkSerials(tx, steps)

    const changed = new Map<string, Level>()
    for (const s of steps) {
      if (s.from) {
        const key = { sku: s.sku, location: s.location, state: s.from }
        const id = levelId(key)
        const next = (levels.get(id) ?? 0) - s.qty
        if (next < 0) {
          throw new LedgerError(
            'insufficient-stock',
            `${s.sku}: only ${levels.get(id) ?? 0} ${s.from} at ${String(s.location)}, cannot move ${s.qty}.`,
          )
        }
        levels.set(id, next)
        changed.set(id, { ...key, qty: next })
      }
      if (s.to) {
        const key = { sku: s.sku, location: s.location, state: s.to }
        const id = levelId(key)
        const next = (levels.get(id) ?? 0) + s.qty
        levels.set(id, next)
        changed.set(id, { ...key, qty: next })
      }
    }

    const createdAt = this.now()
    const movements: MovementRecord[] = steps.map((s) => ({
      sku: s.sku,
      serial: s.serial,
      qty: s.qty,
      fromState: s.from,
      toState: s.to,
      location: s.location,
      docType: s.doc.type,
      docId: s.doc.id,
      user: s.user,
      reason: s.reason,
      createdAt,
    }))
    await tx.insertMovements(movements)
    await tx.writeLevels([...changed.values()])
    if (serials.records.length) await tx.writeSerials(serials.records, serials.created)
  }

  private async checkSkuModes(tx: LedgerTx, steps: readonly Step[]): Promise<void> {
    const bySku = new Map<string, boolean>()
    for (const s of steps) {
      const serial = s.serial !== null
      if (bySku.has(s.sku) && bySku.get(s.sku) !== serial) {
        throw new LedgerError(
          'invalid-move',
          `${s.sku}: one operation cannot mix serialised and bulk movements.`,
        )
      }
      bySku.set(s.sku, serial)
    }
    for (const [sku, serial] of bySku) {
      const mode = await tx.skuMode(sku)
      if (mode === 'serial' && !serial)
        throw new LedgerError(
          'serial-required',
          `${sku} is serialised: move one serial per movement.`,
        )
      if (mode === 'bulk' && serial)
        throw new LedgerError('serial-not-allowed', `${sku} is tracked by quantity, not by serial.`)
    }
  }

  /** Validates each serial's current place and returns the serial rows to write. */
  private async checkSerials(
    tx: LedgerTx,
    steps: readonly Step[],
  ): Promise<{ records: SerialRecord[]; created: Set<string> }> {
    const serialSteps = steps.filter((s): s is Step & { serial: string } => s.serial !== null)
    if (serialSteps.length === 0) return { records: [], created: new Set() }
    const current = await tx.lockSerials([...new Set(serialSteps.map((s) => s.serial))])
    const state = new Map<string, SerialRecord>(current)
    const created = new Set<string>()

    for (const s of serialSteps) {
      const record = state.get(s.serial)
      if (s.from === null) {
        if (record && record.state !== null) {
          throw new LedgerError(
            'serial-duplicate',
            `Serial ${s.serial} is already in the ledger (${record.state} at ${String(record.location)}).`,
          )
        }
        if (record && record.sku !== s.sku) {
          throw new LedgerError(
            'serial-duplicate',
            `Serial ${s.serial} belongs to ${record.sku}, not ${s.sku}.`,
          )
        }
        if (!record && !current.has(s.serial)) created.add(s.serial)
      } else if (
        !record ||
        record.sku !== s.sku ||
        record.state !== s.from ||
        record.location !== s.location
      ) {
        const where = record
          ? `${record.state ?? 'out of the ledger'} at ${String(record.location)}`
          : 'unknown'
        throw new LedgerError(
          'serial-state',
          `Serial ${s.serial} is ${where}, not ${s.from} at ${String(s.location)}.`,
        )
      }
      state.set(s.serial, {
        serial: s.serial,
        sku: s.sku,
        state: s.to,
        location: s.to === null ? null : s.location,
      })
    }
    return {
      records: [...new Set(serialSteps.map((s) => s.serial))].map(
        (serial) => state.get(serial) as SerialRecord,
      ),
      created,
    }
  }
}

function assertQuantity(qty: number): void {
  if (!Number.isSafeInteger(qty) || qty <= 0)
    throw new LedgerError('invalid-quantity', 'Quantities are whole numbers above zero.')
}

function validate(s: Step): void {
  assertQuantity(s.qty)
  if (s.serial !== null && s.qty !== 1)
    throw new LedgerError('invalid-quantity', 'A serialised movement moves exactly one unit.')
  if (s.from === s.to) throw new LedgerError('invalid-move', 'A movement must change state.')
  if (s.from === null && !MAY_ENTER.has(s.doc.type)) {
    throw new LedgerError('invalid-move', `A ${s.doc.type} cannot bring stock into the ledger.`)
  }
  if (s.to === null && !MAY_LEAVE.has(s.doc.type)) {
    throw new LedgerError('invalid-move', `A ${s.doc.type} cannot take stock out of the ledger.`)
  }
  if (NEEDS_REASON.has(s.doc.type) && !s.reason) {
    throw new LedgerError('reason-required', `A ${s.doc.type} movement needs a reason.`)
  }
  if (!s.sku.trim()) throw new LedgerError('invalid-move', 'A movement needs a SKU.')
  if (!s.doc.id.trim())
    throw new LedgerError('invalid-move', 'A movement needs the id of its document.')
}
