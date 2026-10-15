import type { Id } from '../ledger/types'
import type { ProjectPrice } from '../pricing/types'

/** Project registration states (docs/tasks/0017). `reviewing` is the short claim while staff decide. */
export const PROJECT_STATUSES = [
  'submitted',
  'reviewing',
  'approved',
  'rejected',
  'withdrawn',
  'expired',
] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const MAX_PROJECT_LINES = 100
export const MAX_PROJECT_QTY = 100_000
export const MAX_PROJECT_VALIDITY_DAYS = 365

export interface ProjectLine {
  sku: string
  productId: Id | null
  title: string
  qty: number
  /** Net project price granted on approval, market minor units; null until then or if none. */
  price: bigint | null
}

export interface ProjectRecord {
  id: Id
  number: string
  company: Id
  registeredBy: Id
  market: string
  status: ProjectStatus
  /** Scoped to the company: `<company>:<client key>`. */
  idempotencyKey: string
  name: string
  lines: ProjectLine[]
  validUntil: Date | null
  decidedBy: Id | null
  decidedAt: Date | null
  decisionNote: string | null
}

export type NewProject = Omit<ProjectRecord, 'id'> & {
  /** End customer, city, expected close, note: stored as the app shapes them. */
  details: Readonly<Record<string, unknown>>
}

export type ProjectPatch = Partial<
  Pick<ProjectRecord, 'lines' | 'validUntil' | 'decidedBy' | 'decidedAt' | 'decisionNote'>
>

export interface ProjectStore {
  /** `P-AE-2026-000123`, from a database sequence. */
  nextProjectNumber(market: string, now: Date): Promise<string>
  findByIdempotencyKey(key: string): Promise<ProjectRecord | null>
  findByNumber(number: string): Promise<ProjectRecord | null>
  insertProject(project: NewProject): Promise<{ project: ProjectRecord; created: boolean }>
  transition(
    id: Id,
    from: readonly ProjectStatus[],
    to: ProjectStatus,
    patch?: ProjectPatch,
  ): Promise<boolean>
}

export type { ProjectPrice }
