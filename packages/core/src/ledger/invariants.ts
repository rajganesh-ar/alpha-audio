import {
  levelId,
  type Level,
  type MovementRecord,
  type ReservationRecord,
  type SerialRecord,
} from './types'

export interface LedgerSnapshot {
  movements: readonly MovementRecord[]
  levels: readonly Level[]
  serials: readonly SerialRecord[]
  reservations: readonly ReservationRecord[]
}

/**
 * The ledger's invariants (docs/spec, Server logic), checked against a full snapshot:
 *  1. no level is below zero;
 *  2. for every (sku, location, state), the movements sum to the level;
 *  3. every serial has exactly one current state, the one its last movement left it in;
 *  4. reserved stock equals the quantity held by active reservations.
 * Returns human-readable violations; an empty list means the ledger is sound.
 */
export function checkInvariants(snapshot: LedgerSnapshot): string[] {
  const problems: string[] = []
  const derived = new Map<string, number>()
  const add = (
    sku: string,
    location: MovementRecord['location'],
    state: MovementRecord['toState'],
    qty: number,
  ) => {
    if (state === null) return
    const id = levelId({ sku, location, state })
    derived.set(id, (derived.get(id) ?? 0) + qty)
  }
  for (const m of snapshot.movements) {
    add(m.sku, m.location, m.toState, m.qty)
    add(m.sku, m.location, m.fromState, -m.qty)
  }

  const booked = new Map(snapshot.levels.map((l) => [levelId(l), l]))
  for (const level of snapshot.levels) {
    if (level.qty < 0) problems.push(`negative level: ${describe(level)} = ${level.qty}`)
  }
  for (const id of new Set([...derived.keys(), ...booked.keys()])) {
    const fromMovements = derived.get(id) ?? 0
    const level = booked.get(id)?.qty ?? 0
    if (fromMovements !== level)
      problems.push(
        `movements sum to ${fromMovements} but level is ${level}: ${id.replaceAll('\u0000', ' / ')}`,
      )
  }

  const lastMove = new Map<string, MovementRecord>()
  for (const m of snapshot.movements) if (m.serial !== null) lastMove.set(m.serial, m)
  const serialRows = new Map<string, number>()
  for (const s of snapshot.serials) serialRows.set(s.serial, (serialRows.get(s.serial) ?? 0) + 1)
  for (const [serial, rows] of serialRows)
    if (rows !== 1) problems.push(`serial ${serial} has ${rows} records`)
  for (const s of snapshot.serials) {
    const last = lastMove.get(s.serial)
    const expected = last
      ? [last.toState, last.toState === null ? null : last.location]
      : [null, null]
    if (s.state !== expected[0] || (s.state !== null && s.location !== expected[1])) {
      problems.push(
        `serial ${s.serial} is ${s.state} at ${String(s.location)}, its last movement says ${String(expected[0])} at ${String(expected[1])}`,
      )
    }
  }
  for (const serial of lastMove.keys())
    if (!serialRows.has(serial)) problems.push(`serial ${serial} moved but has no record`)

  const held = new Map<string, number>()
  for (const r of snapshot.reservations) {
    if (r.status !== 'active') continue
    const id = levelId({ sku: r.sku, location: r.location, state: 'reserved' })
    held.set(id, (held.get(id) ?? 0) + r.qty)
  }
  for (const level of snapshot.levels.filter((l) => l.state === 'reserved')) {
    const id = levelId(level)
    if ((held.get(id) ?? 0) !== level.qty)
      problems.push(
        `reserved ${level.qty} but active reservations hold ${held.get(id) ?? 0}: ${describe(level)}`,
      )
  }
  return problems
}

const describe = (l: Level) => `${l.sku} / ${String(l.location)} / ${l.state}`
