import type { Id } from '../ledger/types'
import type { ProjectPrice } from '../pricing/types'
import { ORDERING_ROLES } from '../tradeOrders/rules'
import {
  MAX_PROJECT_LINES,
  MAX_PROJECT_QTY,
  MAX_PROJECT_VALIDITY_DAYS,
  type ProjectLine,
  type ProjectRecord,
  type ProjectStatus,
  type ProjectStore,
} from './types'

const DAY_MS = 24 * 60 * 60 * 1000

export type ProjectProblem =
  | 'name'
  | 'end-customer'
  | 'expected-close'
  | 'no-lines'
  | 'too-many-lines'
  | 'invalid-quantity'
  | 'unknown-product'

export interface RegisterInput {
  company: { id: Id; market: string }
  registrant: { id: Id; role: string }
  idempotencyKey: string
  name: string
  endCustomer: string
  /** ISO date (YYYY-MM-DD) the dealer expects to close. */
  expectedClose: string
  /** Lines with the catalogue's product and title (unknown SKUs have a null product). */
  lines: Array<Omit<ProjectLine, 'price'>>
  details: Readonly<Record<string, unknown>>
}

export type RegisterResult =
  | { ok: true; project: ProjectRecord; created: boolean }
  | { ok: false; reason: 'not-allowed' }
  | { ok: false; reason: 'invalid'; problems: ProjectProblem[] }

export interface Decision {
  by: Id
  decision: 'approve' | 'reject'
  /** Net project prices by SKU (approve); lines without one keep normal pricing. */
  prices?: Readonly<Record<string, bigint>> | undefined
  validityDays?: number | undefined
  note?: string | null | undefined
}

export type ProjectDecisionResult =
  | { ok: true; project: ProjectRecord }
  | { ok: false; reason: 'not-found' | 'not-submitted' | 'busy' | 'no-prices' | 'invalid-price' }

/** The project's status as of `at`: approved projects past their validity are expired. */
export function projectState(
  project: Pick<ProjectRecord, 'status' | 'validUntil'>,
  at: Date,
): ProjectStatus {
  return project.status === 'approved' && project.validUntil && project.validUntil <= at
    ? 'expired'
    : project.status
}

/** The prices an order or quote for this project gets at `at`: none unless approved and in date. */
export function projectPrices(project: ProjectRecord, at: Date): ProjectPrice[] {
  if (projectState(project, at) !== 'approved') return []
  return project.lines.flatMap((l) => (l.price === null ? [] : [{ sku: l.sku, price: l.price }]))
}

/**
 * Project registrations (docs/tasks/0017, ADR 0017). A dealer registers the project; staff
 * approve it with project prices and a validity, or reject it; the dealer may withdraw it.
 * Every change is a compare-and-set, so two reviewers cannot both decide.
 */
export class ProjectService {
  constructor(
    private readonly store: ProjectStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async register(input: RegisterInput): Promise<RegisterResult> {
    const key = `${String(input.company.id)}:${input.idempotencyKey}`
    const existing = await this.store.findByIdempotencyKey(key)
    if (existing) return { ok: true, project: existing, created: false }
    if (!ORDERING_ROLES.includes(input.registrant.role)) return { ok: false, reason: 'not-allowed' }
    const problems = this.problems(input)
    if (problems.length) return { ok: false, reason: 'invalid', problems }
    const now = this.now()
    const placed = await this.store.insertProject({
      number: await this.store.nextProjectNumber(input.company.market, now),
      company: input.company.id,
      registeredBy: input.registrant.id,
      market: input.company.market,
      status: 'submitted',
      idempotencyKey: key,
      name: input.name.trim(),
      lines: input.lines.map((l) => ({ ...l, price: null })),
      validUntil: null,
      decidedBy: null,
      decidedAt: null,
      decisionNote: null,
      details: {
        ...input.details,
        endCustomer: input.endCustomer.trim(),
        expectedClose: input.expectedClose,
      },
    })
    return { ok: true, project: placed.project, created: placed.created }
  }

  private problems(input: RegisterInput): ProjectProblem[] {
    const out: ProjectProblem[] = []
    if (!input.name.trim() || input.name.length > 120) out.push('name')
    if (!input.endCustomer.trim() || input.endCustomer.length > 120) out.push('end-customer')
    const close = /^\d{4}-\d{2}-\d{2}$/.test(input.expectedClose)
      ? Date.parse(`${input.expectedClose}T00:00:00Z`)
      : NaN
    if (!Number.isFinite(close) || close < this.now().getTime() - DAY_MS) out.push('expected-close')
    if (input.lines.length === 0) out.push('no-lines')
    if (input.lines.length > MAX_PROJECT_LINES) out.push('too-many-lines')
    if (
      input.lines.some((l) => !Number.isSafeInteger(l.qty) || l.qty < 1 || l.qty > MAX_PROJECT_QTY)
    )
      out.push('invalid-quantity')
    if (input.lines.some((l) => l.productId === null)) out.push('unknown-product')
    return out
  }

  /** Staff approve with project prices and a validity, or reject with a reason. */
  async decide(number: string, decision: Decision): Promise<ProjectDecisionResult> {
    const project = await this.store.findByNumber(number)
    if (!project) return { ok: false, reason: 'not-found' }
    if (project.status === 'reviewing') return { ok: false, reason: 'busy' }
    if (project.status !== 'submitted') return { ok: false, reason: 'not-submitted' }
    const prices = decision.prices ?? {}
    if (decision.decision === 'approve') {
      const given = project.lines.filter((l) => prices[l.sku] !== undefined)
      if (given.length === 0) return { ok: false, reason: 'no-prices' }
      if (given.some((l) => (prices[l.sku] ?? -1n) < 0n))
        return { ok: false, reason: 'invalid-price' }
    }
    if (!(await this.store.transition(project.id, ['submitted'], 'reviewing')))
      return { ok: false, reason: 'busy' }
    const at = this.now()
    const note = decision.note?.trim().slice(0, 500) || null
    if (decision.decision === 'reject') {
      const patch = { decidedBy: decision.by, decidedAt: at, decisionNote: note }
      await this.store.transition(project.id, ['reviewing'], 'rejected', patch)
      return { ok: true, project: { ...project, ...patch, status: 'rejected' } }
    }
    const days = Math.min(
      Math.max(Math.trunc(decision.validityDays ?? 90), 1),
      MAX_PROJECT_VALIDITY_DAYS,
    )
    const patch = {
      lines: project.lines.map((l) => ({ ...l, price: prices[l.sku] ?? null })),
      validUntil: new Date(at.getTime() + days * DAY_MS),
      decidedBy: decision.by,
      decidedAt: at,
      decisionNote: note,
    }
    await this.store.transition(project.id, ['reviewing'], 'approved', patch)
    return { ok: true, project: { ...project, ...patch, status: 'approved' } }
  }

  /** The company withdraws a project still submitted or approved. */
  async withdraw(number: string): Promise<ProjectDecisionResult> {
    const project = await this.store.findByNumber(number)
    if (!project) return { ok: false, reason: 'not-found' }
    if (project.status === 'reviewing') return { ok: false, reason: 'busy' }
    if (!(await this.store.transition(project.id, ['submitted', 'approved'], 'withdrawn')))
      return { ok: false, reason: 'not-submitted' }
    return { ok: true, project: { ...project, status: 'withdrawn' } }
  }
}
