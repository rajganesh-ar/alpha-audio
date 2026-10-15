import { LedgerError } from '../ledger/errors'
import type { LedgerService } from '../ledger/LedgerService'
import type { Id } from '../ledger/types'
import {
  ORDERING_ROLES,
  approvalsFor,
  checkOrderRules,
  rulesPass,
  type OrderRules,
  type RuleCheck,
} from './rules'
import {
  PENDING_HOLD_MS,
  type Approval,
  type ApprovalKind,
  type TradeLine,
  type TradeOrderRecord,
  type TradeOrderStore,
  type TradeTotals,
} from './types'

export interface SubmitInput {
  company: {
    id: Id
    market: string
    hold: boolean
    /** Minor units of the market currency; null without a credit line. */
    creditLimit: bigint | null
    rules: OrderRules
  }
  placer: { id: Id; role: string; approvalThreshold: bigint | null }
  /** The client's key; the service scopes it to the company. */
  idempotencyKey: string
  /** Priced by the engine for this company now (`resolvePrices`); never from the client. */
  lines: TradeLine[]
  totals: TradeTotals
  details: Readonly<Record<string, unknown>>
}

export type SubmitResult =
  | { ok: true; order: TradeOrderRecord; created: boolean }
  | { ok: false; reason: 'not-allowed' | 'on-hold' }
  | { ok: false; reason: 'rules'; problems: RuleCheck }
  | { ok: false; reason: 'unavailable'; order: TradeOrderRecord; skus: string[] }
  /** Another request with the same key is still reserving. */
  | { ok: false; reason: 'in-progress'; order: TradeOrderRecord }

export type DecisionResult =
  | { ok: true; order: TradeOrderRecord }
  | { ok: false; reason: 'not-found' | 'not-pending' | 'nothing-to-decide' | 'busy' }

export interface Decider {
  kind: ApprovalKind
  by: Id
}

/**
 * Dealer orders on account (docs/tasks/0015, ADR 0015). The credit check and the insert run
 * under a per-company lock, so parallel orders see each other's credit; stock is held for every
 * line or none; each status change is a compare-and-set, so double submits, double clicks and
 * racing approvers cannot confirm twice or move stock twice.
 */
export class TradeOrderService {
  constructor(
    private readonly store: TradeOrderStore,
    private readonly ledger: LedgerService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** What the order would need right now: rule problems and approvals (the review page). */
  async preview(
    input: Omit<SubmitInput, 'idempotencyKey' | 'details' | 'placer'> & {
      placer: SubmitInput['placer']
    },
  ): Promise<{ problems: RuleCheck; approvals: Approval[]; creditUsed: bigint }> {
    const creditUsed = await this.store.creditUsed(input.company.id)
    return {
      problems: checkOrderRules(input.lines, input.totals.net, input.company.rules),
      approvals: approvalsFor({
        placer: input.placer,
        lines: input.lines,
        totals: input.totals,
        creditLimit: input.company.creditLimit,
        creditUsed,
      }),
      creditUsed,
    }
  }

  async submit(input: SubmitInput): Promise<SubmitResult> {
    const key = `${String(input.company.id)}:${input.idempotencyKey}`
    const existing = await this.store.findByIdempotencyKey(key)
    if (existing) return this.resume(existing)
    if (!ORDERING_ROLES.includes(input.placer.role)) return { ok: false, reason: 'not-allowed' }
    if (input.company.hold) return { ok: false, reason: 'on-hold' }
    const problems = checkOrderRules(input.lines, input.totals.net, input.company.rules)
    if (!rulesPass(problems)) return { ok: false, reason: 'rules', problems }

    const now = this.now()
    const placed = await this.store.withCompanyLock(input.company.id, async () => {
      const again = await this.store.findByIdempotencyKey(key)
      if (again) return { order: again, created: false }
      const approvals = approvalsFor({
        placer: input.placer,
        lines: input.lines,
        totals: input.totals,
        creditLimit: input.company.creditLimit,
        creditUsed: await this.store.creditUsed(input.company.id),
      })
      return this.store.insertOrder({
        number: await this.store.nextOrderNumber(input.company.market, now),
        company: input.company.id,
        placedBy: input.placer.id,
        market: input.company.market,
        status: 'reserving',
        idempotencyKey: key,
        lines: input.lines,
        totals: input.totals,
        approvals,
        reservations: [],
        holdExpiresAt: null,
        failureReason: null,
        unavailableSkus: [],
        closedReason: null,
        details: input.details,
      })
    })
    if (!placed.created) return this.resume(placed.order)
    const order = placed.order

    const pending = order.approvals.length > 0
    const holdExpiresAt = pending ? new Date(now.getTime() + PENDING_HOLD_MS) : null
    const held: Id[] = []
    const missing: string[] = []
    for (const line of order.lines) {
      const r = await this.ledger.reserve({
        sku: line.sku,
        qty: line.qty,
        market: order.market,
        doc: { type: 'order', id: order.number },
        expiresAt: holdExpiresAt,
      })
      if (r.ok) held.push(r.reservation.id)
      else missing.push(line.sku)
    }
    if (missing.length) {
      await this.releaseAll(held)
      await this.store.transition(order.id, ['reserving'], 'unavailable', {
        unavailableSkus: missing,
      })
      return {
        ok: false,
        reason: 'unavailable',
        order: { ...order, status: 'unavailable', unavailableSkus: missing },
        skus: missing,
      }
    }
    const status = pending ? 'pending-approval' : 'confirmed'
    await this.store.transition(order.id, ['reserving'], status, {
      reservations: held,
      holdExpiresAt,
    })
    return {
      ok: true,
      created: true,
      order: { ...order, status, reservations: held, holdExpiresAt },
    }
  }

  private resume(order: TradeOrderRecord): SubmitResult {
    if (order.status === 'reserving') return { ok: false, reason: 'in-progress', order }
    if (order.status === 'unavailable')
      return { ok: false, reason: 'unavailable', order, skus: order.unavailableSkus }
    return { ok: true, order, created: false }
  }

  /**
   * Records a decision on the order's pending approvals of the decider's kind. A rejection
   * closes the order and releases its stock; the last approval confirms it, making the holds
   * permanent (re-reserving any that lapsed, or failing with `stock-lost`).
   */
  async decide(
    number: string,
    decider: Decider,
    decision: 'approve' | 'reject',
    note: string | null = null,
  ): Promise<DecisionResult> {
    const order = await this.store.findByNumber(number)
    if (!order) return { ok: false, reason: 'not-found' }
    if (order.status === 'approving') return { ok: false, reason: 'busy' }
    if (order.status !== 'pending-approval') return { ok: false, reason: 'not-pending' }
    if (!order.approvals.some((a) => a.kind === decider.kind && a.status === 'pending'))
      return { ok: false, reason: 'nothing-to-decide' }
    if (!(await this.store.transition(order.id, ['pending-approval'], 'approving')))
      return { ok: false, reason: 'busy' }

    const at = this.now()
    const approvals = order.approvals.map((a): Approval =>
      a.kind === decider.kind && a.status === 'pending'
        ? {
            ...a,
            status: decision === 'approve' ? 'approved' : 'rejected',
            by: decider.by,
            at,
            note,
          }
        : a,
    )
    if (decision === 'reject') {
      await this.releaseAll(order.reservations)
      await this.store.transition(order.id, ['approving'], 'rejected', {
        approvals,
        closedReason: note,
        holdExpiresAt: null,
      })
      return { ok: true, order: { ...order, status: 'rejected', approvals, closedReason: note } }
    }
    if (approvals.some((a) => a.status === 'pending')) {
      await this.store.transition(order.id, ['approving'], 'pending-approval', { approvals })
      return { ok: true, order: { ...order, status: 'pending-approval', approvals } }
    }

    const doc = { type: 'order' as const, id: order.number }
    const holds: Id[] = []
    for (const [i, line] of order.lines.entries()) {
      const reservation = order.reservations[i]
      try {
        if (reservation === undefined)
          throw new LedgerError('reservation-not-found', 'No hold for this line.')
        holds.push((await this.ledger.confirm(reservation, { doc, expiresAt: null })).id)
      } catch (error) {
        if (!(error instanceof LedgerError)) throw error
        // The pending hold lapsed: hold again if the stock is still there.
        const again = await this.ledger.reserve({
          sku: line.sku,
          qty: line.qty,
          market: order.market,
          doc,
          expiresAt: null,
        })
        if (again.ok) holds.push(again.reservation.id)
        else {
          await this.releaseAll(holds)
          await this.store.transition(order.id, ['approving'], 'failed', {
            approvals,
            failureReason: 'stock-lost',
            reservations: [],
            holdExpiresAt: null,
          })
          return {
            ok: true,
            order: { ...order, status: 'failed', approvals, failureReason: 'stock-lost' },
          }
        }
      }
    }
    await this.store.transition(order.id, ['approving'], 'confirmed', {
      approvals,
      reservations: holds,
      holdExpiresAt: null,
    })
    return {
      ok: true,
      order: { ...order, status: 'confirmed', approvals, reservations: holds, holdExpiresAt: null },
    }
  }

  /** The company withdraws an order still waiting for approval; its stock is released. */
  async cancel(number: string, reason: string | null = null): Promise<DecisionResult> {
    const order = await this.store.findByNumber(number)
    if (!order) return { ok: false, reason: 'not-found' }
    if (order.status === 'approving') return { ok: false, reason: 'busy' }
    if (
      !(await this.store.transition(order.id, ['pending-approval'], 'cancelled', {
        closedReason: reason,
        holdExpiresAt: null,
      }))
    )
      return { ok: false, reason: 'not-pending' }
    await this.releaseAll(order.reservations)
    return { ok: true, order: { ...order, status: 'cancelled', closedReason: reason } }
  }

  /** Releases holds that are still active; ones that already lapsed are skipped. */
  private async releaseAll(ids: readonly Id[]): Promise<void> {
    for (const id of ids) {
      try {
        await this.ledger.release(id, { reason: 'trade-order' })
      } catch (error) {
        if (!(error instanceof LedgerError)) throw error
      }
    }
  }
}
