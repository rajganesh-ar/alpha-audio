import type { Payload, Where } from 'payload'
import { sql, type SQL } from '@payloadcms/db-postgres/drizzle'
import {
  ProjectService,
  projectPrices,
  projectState,
  type Id,
  type NewProject,
  type ProjectDecisionResult,
  type ProjectLine,
  type ProjectPatch,
  type ProjectPrice,
  type ProjectRecord,
  type ProjectStatus,
  type ProjectStore,
  type RegisterResult,
} from '@alpha/core'
import { companyOf } from '../access'
import type { LocaleCode } from '../markets/codes'
import { drizzleOf } from './ledgerStore'
import { companyContext } from './pricing'
import { mergeDraftLines, type OrderDraftLine } from './tradeOrders'

/**
 * Project registrations (docs/tasks/0017, ADR 0017). System code: every registration field is
 * system-written, so they are written here with `overrideAccess: true`. Dealers register and
 * withdraw their own company's; staff decide. Project prices leave only for the company's own,
 * approved, in-date project.
 */

const system = {
  depth: 0,
  // System code: registration fields are system-written (see the module comment).
  overrideAccess: true,
} as const

interface ProjectDoc {
  id: number
  number: string
  company: number | { id: number }
  registeredBy: number | { id: number }
  market: string
  status: ProjectStatus
  idempotencyKey: string
  name: string
  lines?: Array<{
    product?: number | { id: number } | null
    sku: string
    title: string
    qty: number
    projectPrice?: number | null
  }> | null
  validUntil?: string | null
  decidedBy?: number | { id: number } | null
  decidedAt?: string | null
  decisionNote?: string | null
}

const idOf = (v: number | { id: number } | null | undefined): number | null =>
  v === null || v === undefined ? null : typeof v === 'object' ? v.id : v

export function toProjectRecord(doc: ProjectDoc): ProjectRecord {
  return {
    id: doc.id,
    number: doc.number,
    company: idOf(doc.company) ?? 0,
    registeredBy: idOf(doc.registeredBy) ?? 0,
    market: doc.market,
    status: doc.status,
    idempotencyKey: doc.idempotencyKey,
    name: doc.name,
    lines: (doc.lines ?? []).map((l): ProjectLine => ({
      sku: l.sku,
      productId: idOf(l.product),
      title: l.title,
      qty: Number(l.qty),
      price: typeof l.projectPrice === 'number' ? BigInt(Math.trunc(l.projectPrice)) : null,
    })),
    validUntil: doc.validUntil ? new Date(doc.validUntil) : null,
    decidedBy: idOf(doc.decidedBy),
    decidedAt: doc.decidedAt ? new Date(doc.decidedAt) : null,
    decisionNote: doc.decisionNote ?? null,
  }
}

export class PostgresProjectStore implements ProjectStore {
  constructor(private readonly payload: Payload) {}

  private get db() {
    return drizzleOf(this.payload)
  }

  private async findOne(where: Where): Promise<ProjectRecord | null> {
    const { docs } = await this.payload.find({
      collection: 'project-registrations',
      where,
      limit: 1,
      ...system,
    })
    const doc = docs[0] as unknown as ProjectDoc | undefined
    return doc ? toProjectRecord(doc) : null
  }

  async nextProjectNumber(market: string, now: Date): Promise<string> {
    const { rows } = await this.db.execute(sql`SELECT nextval('project_number_seq') AS n`)
    return `P-${market.toUpperCase()}-${now.getUTCFullYear()}-${String(rows[0]?.['n']).padStart(6, '0')}`
  }

  findByIdempotencyKey(key: string) {
    return this.findOne({ idempotencyKey: { equals: key } })
  }

  findByNumber(number: string) {
    return this.findOne({ number: { equals: number } })
  }

  async insertProject(project: NewProject) {
    const d = project.details as {
      endCustomer?: string
      expectedClose?: string
      city?: string | null
      note?: string | null
    }
    try {
      const doc = await this.payload.create({
        collection: 'project-registrations',
        data: {
          number: project.number,
          status: project.status,
          company: Number(project.company),
          registeredBy: Number(project.registeredBy),
          market: project.market as never, // reason: a market code, checked by the select field
          name: project.name,
          endCustomer: d.endCustomer ?? '',
          city: d.city ?? null,
          expectedClose: `${d.expectedClose ?? ''}T00:00:00.000Z`,
          note: d.note ?? null,
          lines: project.lines.map((l) => ({
            product: typeof l.productId === 'number' ? l.productId : Number(l.productId) || null,
            sku: l.sku,
            title: l.title,
            qty: l.qty,
            projectPrice: l.price === null ? null : Number(l.price),
          })),
          idempotencyKey: project.idempotencyKey,
        },
        ...system,
      })
      return { project: toProjectRecord(doc as unknown as ProjectDoc), created: true }
    } catch (error) {
      const existing = await this.findByIdempotencyKey(project.idempotencyKey)
      if (existing) return { project: existing, created: false }
      throw error
    }
  }

  async transition(
    id: Id,
    from: readonly ProjectStatus[],
    to: ProjectStatus,
    patch: ProjectPatch = {},
  ) {
    const sets: SQL[] = [sql`updated_at = now()`]
    if (patch.validUntil !== undefined)
      sets.push(sql`valid_until = ${patch.validUntil ? patch.validUntil.toISOString() : null}`)
    if (patch.decidedAt !== undefined)
      sets.push(sql`decided_at = ${patch.decidedAt ? patch.decidedAt.toISOString() : null}`)
    if (patch.decidedBy !== undefined)
      sets.push(sql`decided_by_id = ${patch.decidedBy === null ? null : Number(patch.decidedBy)}`)
    if (patch.decisionNote !== undefined) sets.push(sql`decision_note = ${patch.decisionNote}`)
    const { rows } = await this.db.execute(sql`
      UPDATE project_registrations SET status = ${to}, ${sql.join(sets, sql`, `)}
      WHERE id = ${Number(id)} AND status::text IN (${sql.join(
        from.map((s) => sql`${s}`),
        sql`, `,
      )})
      RETURNING id`)
    const won = rows.length === 1
    if (won && patch.lines) {
      // Lines live in their own table; the project prices are written with them.
      const current = await this.payload.findByID({
        collection: 'project-registrations',
        id: Number(id),
        ...system,
      })
      const byLine = new Map(patch.lines.map((l) => [l.sku, l.price]))
      await this.payload.update({
        collection: 'project-registrations',
        id: Number(id),
        data: {
          lines: ((current as unknown as ProjectDoc).lines ?? []).map((l) => {
            const price = byLine.get(l.sku)
            return {
              ...l,
              projectPrice: price === null || price === undefined ? null : Number(price),
            }
          }),
        },
        ...system,
      })
    }
    return won
  }
}

export const createProjects = (payload: Payload, now?: () => Date) =>
  new ProjectService(new PostgresProjectStore(payload), now)

// ── For the signed-in company user ───────────────────────────────────────────────────────────

export interface ProjectInput {
  idempotencyKey: string
  name: string
  endCustomer: string
  city?: string | null | undefined
  expectedClose: string
  note?: string | null | undefined
  lines: readonly OrderDraftLine[]
  locale: LocaleCode
}

/** Registers a project for the signed-in company user; null for anyone else. */
export async function registerProject(
  payload: Payload,
  user: unknown,
  input: ProjectInput,
  now?: () => Date,
): Promise<RegisterResult | null> {
  const session = await companyContext(payload, user)
  if (!session) return null
  const lines = mergeDraftLines(input.lines)
  const products = lines.length
    ? await payload.find({
        collection: 'products',
        where: { sku: { in: lines.map((l) => l.sku) } },
        locale: input.locale,
        limit: lines.length,
        depth: 0,
        draft: false,
        user: user as never, // reason: the caller's authenticated user, typed by Payload per app
        overrideAccess: false,
        select: { sku: true, title: true },
      })
    : { docs: [] }
  const bySku = new Map(
    (products.docs as unknown as Array<{ id: number; sku: string; title?: string | null }>).map(
      (p) => [p.sku, p],
    ),
  )
  const placer = (await payload.findByID({
    collection: 'company-users',
    id: Number((user as { id: unknown }).id),
    ...system,
  })) as unknown as { id: number; role?: string | null }
  return createProjects(payload, now).register({
    company: { id: session.company.id, market: session.company.market },
    registrant: { id: placer.id, role: placer.role ?? 'viewer' },
    idempotencyKey: input.idempotencyKey,
    name: input.name.slice(0, 200),
    endCustomer: input.endCustomer.slice(0, 200),
    expectedClose: input.expectedClose,
    lines: lines.map((l) => ({
      sku: l.sku,
      productId: bySku.get(l.sku)?.id ?? null,
      title: bySku.get(l.sku)?.title ?? l.sku,
      qty: l.qty,
    })),
    details: {
      city: input.city?.trim().slice(0, 80) || null,
      note: input.note?.trim().slice(0, 1000) || null,
    },
  })
}

/**
 * The project an order or quote of the signed-in company user is for, with the prices in force
 * now; null unless it is the user's own company's, in the company's market, approved and in date.
 */
export async function projectForSession(
  payload: Payload,
  user: unknown,
  number: string,
  at: Date = new Date(),
): Promise<{ number: string; name: string; prices: ProjectPrice[] } | null> {
  const company = companyOf(user)
  if (company === null) return null
  const session = await companyContext(payload, user, at)
  const project = await new PostgresProjectStore(payload).findByNumber(number)
  if (
    !session ||
    !project ||
    String(project.company) !== String(company) ||
    project.market !== session.company.market ||
    projectState(project, at) !== 'approved'
  )
    return null
  return { number: project.number, name: project.name, prices: projectPrices(project, at) }
}

/** Withdraws the signed-in company user's own project (owners and purchasers). */
export async function withdrawProject(
  payload: Payload,
  user: unknown,
  number: string,
): Promise<ProjectDecisionResult | { ok: false; reason: 'forbidden' }> {
  const company = companyOf(user)
  const project =
    company === null ? null : await new PostgresProjectStore(payload).findByNumber(number)
  if (!project || String(project.company) !== String(company))
    return { ok: false, reason: 'not-found' }
  const role = String((user as { role?: unknown }).role ?? '')
  if (role !== 'owner' && role !== 'purchaser') return { ok: false, reason: 'forbidden' }
  return createProjects(payload).withdraw(number)
}

/** Staff decide a registration: approve with project prices (by SKU) and a validity, or reject. */
export async function decideProject(
  payload: Payload,
  user: unknown,
  number: string,
  decision: {
    decision: 'approve' | 'reject'
    prices?: Readonly<Record<string, bigint>>
    validityDays?: number
    note?: string | null
  },
  now?: () => Date,
): Promise<ProjectDecisionResult | { ok: false; reason: 'forbidden' }> {
  if ((user as { collection?: string } | null)?.collection !== 'users')
    return { ok: false, reason: 'forbidden' }
  return createProjects(payload, now).decide(number, {
    by: (user as { id: Id }).id,
    ...decision,
  })
}
