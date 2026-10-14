import { LedgerError } from './errors'
import type { LedgerService } from './LedgerService'
import type { Id, ReservationDocType, StockState } from './types'

/** Small deterministic PRNG (mulberry32), so a failing run can be replayed from its seed. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface ScenarioOptions {
  steps: number
  seed: number
  /** Bulk SKUs move by quantity; serialised SKUs one serial per movement. */
  bulkSkus: readonly string[]
  serialSkus: readonly string[]
  locations: readonly Id[]
  market: string
}

export interface ScenarioReport {
  attempted: number
  applied: number
  /** Operations the ledger refused (by rule), by error code. */
  refused: Record<string, number>
}

const SIDE_STATES: readonly StockState[] = ['demo', 'ex_display', 'damaged', 'quarantine', 'rma']

/**
 * Drives a ledger through a random mix of every operation: receipts, putaway, side moves,
 * transfers, reservations (cart, quote, POS, order), releases, picks, shipping, delivery and
 * counts. Many attempts are refused on purpose (moving stock that is not there); the point is
 * that whatever is accepted leaves the ledger consistent.
 */
export async function runScenario(
  ledger: LedgerService,
  options: ScenarioOptions,
): Promise<ScenarioReport> {
  const random = rng(options.seed)
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T
  const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1))
  const report: ScenarioReport = { attempted: 0, applied: 0, refused: {} }
  const active: Array<{
    id: Id
    picked: boolean
    sku: string
    location: Id
    serials: string[]
    qty: number
  }> = []
  const serialsOf = new Map<string, Array<{ serial: string; location: Id; state: StockState }>>()
  let serialSeq = 0

  for (let i = 0; i < options.steps; i++) {
    const serialised = random() < 0.35 && options.serialSkus.length > 0
    const sku = serialised ? pick(options.serialSkus) : pick(options.bulkSkus)
    const location = pick(options.locations)
    const doc = (type: Parameters<LedgerService['move']>[0]['doc']['type']) => ({
      type,
      id: `${type}-${i}`,
    })
    const roll = random()
    report.attempted++
    try {
      if (serialised) {
        const units = serialsOf.get(sku) ?? []
        serialsOf.set(sku, units)
        if (roll < 0.3 || units.length === 0) {
          const serial = `${sku}-S${++serialSeq}`
          await ledger.move({
            sku,
            qty: 1,
            serial,
            from: null,
            to: 'available',
            location,
            doc: doc('receipt'),
          })
          units.push({ serial, location, state: 'available' })
        } else {
          const unit = pick(units)
          if (roll < 0.55 && unit.state === 'available') {
            const to = pick(SIDE_STATES)
            await ledger.move({
              sku,
              qty: 1,
              serial: unit.serial,
              from: 'available',
              to,
              location: unit.location,
              doc: doc('adjustment'),
              reason: 'scenario',
            })
            unit.state = to
          } else if (roll < 0.7 && unit.state !== 'available' && SIDE_STATES.includes(unit.state)) {
            await ledger.move({
              sku,
              qty: 1,
              serial: unit.serial,
              from: unit.state,
              to: 'available',
              location: unit.location,
              doc: doc('adjustment'),
              reason: 'scenario',
            })
            unit.state = 'available'
          } else if (roll < 0.85 && unit.state === 'available') {
            const to = pick(options.locations.filter((l) => l !== unit.location))
            await ledger.transfer({
              sku,
              qty: 1,
              serial: unit.serial,
              from: { location: unit.location, state: 'available' },
              to: { location: to, state: 'available' },
              doc: doc('transfer'),
            })
            unit.location = to
          } else {
            const r = await ledger.reserve({
              sku,
              qty: 1,
              location: unit.location,
              doc: doc('order') as { type: ReservationDocType; id: string },
            })
            if (r.ok) {
              active.push({
                id: r.reservation.id,
                picked: false,
                sku,
                location: r.reservation.location,
                serials: r.reservation.serials,
                qty: 1,
              })
              for (const s of units)
                if (r.reservation.serials.includes(s.serial)) s.state = 'reserved'
            }
          }
        }
      } else if (roll < 0.2) {
        await ledger.move({
          sku,
          qty: int(1, 8),
          from: null,
          to: 'received',
          location,
          doc: doc('receipt'),
        })
      } else if (roll < 0.35) {
        await ledger.move({
          sku,
          qty: int(1, 6),
          from: 'received',
          to: 'available',
          location,
          doc: doc('receipt'),
        })
      } else if (roll < 0.45) {
        await ledger.move({
          sku,
          qty: int(1, 3),
          from: 'available',
          to: pick(SIDE_STATES),
          location,
          doc: doc('adjustment'),
          reason: 'scenario',
        })
      } else if (roll < 0.52) {
        const to = pick(options.locations.filter((l) => l !== location))
        await ledger.transfer({
          sku,
          qty: int(1, 3),
          from: { location, state: 'available' },
          to: { location: to, state: 'available' },
          doc: doc('transfer'),
        })
      } else if (roll < 0.72) {
        const type = pick(['cart', 'quote', 'pos', 'order'] as const)
        const r = await ledger.reserve({
          sku,
          qty: int(1, 3),
          ...(random() < 0.5 ? { market: options.market } : { location }),
          doc: { type, id: `${type}-${i}` },
        })
        if (r.ok)
          active.push({
            id: r.reservation.id,
            picked: false,
            sku,
            location: r.reservation.location,
            serials: [],
            qty: r.reservation.qty,
          })
      } else if (roll < 0.82 && active.length) {
        const index = int(0, active.length - 1)
        const r = active[index] as (typeof active)[number]
        if (random() < 0.5) await ledger.release(r.id, { reason: 'scenario' })
        else await ledger.pick(r.id)
        active.splice(index, 1)
      } else if (roll < 0.9) {
        await ledger.ship({ sku, qty: int(1, 2), location, doc: doc('shipment') })
      } else if (roll < 0.95) {
        await ledger.deliver({ sku, qty: int(1, 2), location, doc: doc('shipment') })
      } else {
        await ledger.adjustFromCount({
          sku,
          location,
          counted: int(0, 10),
          reason: 'scenario count',
          countId: `count-${i}`,
        })
      }
      report.applied++
    } catch (error) {
      if (!(error instanceof LedgerError)) throw error
      report.refused[error.code] = (report.refused[error.code] ?? 0) + 1
    }
  }
  return report
}
