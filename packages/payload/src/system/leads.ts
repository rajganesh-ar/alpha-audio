import { createHmac } from 'node:crypto'
import type { Payload, Where } from 'payload'
import { sql, type SQL } from '@payloadcms/db-postgres/drizzle'
import {
  BLOCKING_FLAGS,
  LeadService,
  leadLimit,
  normaliseEmail,
  publishedIn,
  type Id,
  type LeadActionResult,
  type LeadAttempt,
  type LeadCandidate,
  type LeadNotificationTemplate,
  type LeadOutcome,
  type LeadPatch,
  type LeadRecord,
  type LeadSource,
  type LeadStatus,
  type LeadStore,
  type NewLead,
} from '@alpha/core'
import { toAgreement } from '../collections/catalog/BrandAgreements'
import { companyOf } from '../access'
import type { LocaleCode, MarketCode } from '../markets/codes'
import { drizzleOf } from './ledgerStore'
import { brandsSellableIn, loadRightsWindows } from './marketRights'
import { NOTIFICATIONS_QUEUE, SEND_NOTIFICATION } from './notifications'

/**
 * Leads (docs/tasks/0018, ADR 0018). System code: leads, agreements, companies and the
 * notification outbox are system-only, so they are read and written here with
 * `overrideAccess: true`. The shopper is anonymous; a company acts only on leads offered to it.
 */

export const LEADS_QUEUE = 'leads'
export const ROUTE_LEAD = 'routeLead'

const system = {
  depth: 0,
  // System code: see the module comment.
  overrideAccess: true,
} as const
const HOUR = 60 * 60 * 1000

interface LeadDoc {
  id: number
  number: string
  market: string
  status: LeadStatus
  routing: 'alpha' | 'dealer'
  city?: string | null
  offeredTo?: number | { id: number } | null
  acceptBy?: string | null
  attempts?: unknown
  outcome?: LeadOutcome | null
  value?: number | null
}

const idOf = (v: number | { id: number } | null | undefined): number | null =>
  v === null || v === undefined ? null : typeof v === 'object' ? v.id : v

function attemptsOf(value: unknown): LeadAttempt[] {
  if (!Array.isArray(value)) return []
  return value.map((a: Record<string, unknown>) => ({
    company: a['company'] as Id,
    offeredAt: new Date(String(a['offeredAt'])),
    acceptBy: new Date(String(a['acceptBy'])),
    result: a['result'] as LeadAttempt['result'],
  }))
}

export function toLeadRecord(doc: LeadDoc): LeadRecord {
  return {
    id: doc.id,
    number: doc.number,
    market: doc.market,
    status: doc.status,
    routing: doc.routing,
    city: doc.city ?? null,
    offeredTo: idOf(doc.offeredTo),
    acceptBy: doc.acceptBy ? new Date(doc.acceptBy) : null,
    attempts: attemptsOf(doc.attempts),
    outcome: doc.outcome ?? null,
    value: typeof doc.value === 'number' ? BigInt(Math.trunc(doc.value)) : null,
  }
}

const attemptsJson = (attempts: readonly LeadAttempt[]) =>
  attempts.map((a) => ({
    company: a.company,
    offeredAt: a.offeredAt.toISOString(),
    acceptBy: a.acceptBy.toISOString(),
    result: a.result,
  }))

export class PostgresLeadStore implements LeadStore {
  constructor(private readonly payload: Payload) {}

  private get db() {
    return drizzleOf(this.payload)
  }

  private async findOne(where: Where): Promise<LeadRecord | null> {
    const { docs } = await this.payload.find({ collection: 'leads', where, limit: 1, ...system })
    const doc = docs[0] as unknown as LeadDoc | undefined
    return doc ? toLeadRecord(doc) : null
  }

  async nextLeadNumber(market: string, now: Date): Promise<string> {
    const { rows } = await this.db.execute(sql`SELECT nextval('lead_number_seq') AS n`)
    return `L-${market.toUpperCase()}-${now.getUTCFullYear()}-${String(rows[0]?.['n']).padStart(6, '0')}`
  }

  findByNumber(number: string) {
    return this.findOne({ number: { equals: number } })
  }

  async insertLead(lead: NewLead) {
    const d = lead.details as {
      source?: LeadSource
      locale?: LocaleCode
      brand?: number | null
      product?: number | null
      message?: string | null
      contact?: { name?: string; email?: string; phone?: string | null }
      consent?: boolean
      requestIpHash?: string | null
    }
    try {
      const doc = await this.payload.create({
        collection: 'leads',
        data: {
          number: lead.number,
          status: lead.status,
          source: d.source ?? 'specialist',
          routing: lead.routing,
          market: lead.market as MarketCode,
          locale: d.locale ?? 'en',
          brand: d.brand ?? null,
          product: d.product ?? null,
          city: lead.city,
          message: d.message ?? null,
          contact: d.contact ?? {},
          consent: Boolean(d.consent),
          attempts: [],
          idempotencyKey: lead.idempotencyKey,
          requestIpHash: d.requestIpHash ?? null,
        },
        ...system,
      })
      return { lead: toLeadRecord(doc as unknown as LeadDoc), created: true }
    } catch (error) {
      const { docs } = await this.payload.find({
        collection: 'leads',
        where: { idempotencyKey: { equals: lead.idempotencyKey } },
        limit: 1,
        ...system,
      })
      const existing = docs[0] as unknown as LeadDoc | undefined
      if (existing) return { lead: toLeadRecord(existing), created: false }
      throw error
    }
  }

  async transition(id: Id, from: readonly LeadStatus[], to: LeadStatus, patch: LeadPatch = {}) {
    const sets: SQL[] = [sql`updated_at = now()`]
    if (patch.offeredTo !== undefined)
      sets.push(sql`offered_to_id = ${patch.offeredTo === null ? null : Number(patch.offeredTo)}`)
    if (patch.acceptBy !== undefined)
      sets.push(sql`accept_by = ${patch.acceptBy ? patch.acceptBy.toISOString() : null}`)
    if (patch.attempts !== undefined)
      sets.push(sql`attempts = ${JSON.stringify(attemptsJson(patch.attempts))}::jsonb`)
    if (patch.outcome !== undefined) sets.push(sql`outcome = ${patch.outcome}`)
    if (patch.value !== undefined)
      sets.push(sql`value = ${patch.value === null ? null : Number(patch.value)}`)
    const { rows } = await this.db.execute(sql`
      UPDATE leads SET status = ${to}, ${sql.join(sets, sql`, `)}
      WHERE id = ${Number(id)} AND status::text IN (${sql.join(
        from.map((s) => sql`${s}`),
        sql`, `,
      )})
      RETURNING id`)
    return rows.length === 1
  }

  async listExpiredOffers(now: Date, limit: number) {
    const { rows } = await this.db.execute(sql`
      SELECT number FROM leads WHERE status = 'offered' AND accept_by <= ${now.toISOString()}
      ORDER BY accept_by LIMIT ${limit}`)
    const found = await Promise.all(rows.map((r) => this.findByNumber(String(r['number']))))
    return found.filter((l): l is LeadRecord => l !== null)
  }
}

export const createLeads = (payload: Payload, now?: () => Date) =>
  new LeadService(new PostgresLeadStore(payload), now)

/** Companies in the market that accept leads, with territories and open-lead counts. */
async function candidates(payload: Payload, market: string): Promise<LeadCandidate[]> {
  const { docs } = await payload.find({
    collection: 'companies',
    where: {
      and: [{ market: { equals: market } }, { 'settings.acceptsLeads': { equals: true } }],
    },
    limit: 500,
    pagination: false,
    ...system,
  })
  const companies = docs as unknown as Array<{ id: number; territories?: string[] | null }>
  if (companies.length === 0) return []
  const { rows } = await drizzleOf(payload).execute(sql`
    SELECT offered_to_id AS company, COUNT(*)::int AS open FROM leads
    WHERE status IN ('offered', 'accepted') AND offered_to_id IN (${sql.join(
      companies.map((c) => sql`${c.id}`),
      sql`, `,
    )})
    GROUP BY offered_to_id`)
  const open = new Map(rows.map((r) => [Number(r['company']), Number(r['open'])]))
  return companies.map((c) => ({
    id: c.id,
    territories: c.territories ?? [],
    openLeads: open.get(c.id) ?? 0,
  }))
}

/** The brand's lead routing in the market now (ADR 0008 agreements); Alpha when unclear. */
async function routingFor(
  payload: Payload,
  brand: number | null,
  market: string,
  at: Date,
): Promise<'alpha' | 'dealer'> {
  if (brand === null) return 'alpha'
  const { docs } = await payload.find({
    collection: 'brand-agreements',
    where: { and: [{ brand: { equals: brand } }, { market: { equals: market } }] },
    limit: 50,
    ...system,
  })
  const live = docs
    .map(toAgreement)
    .find(
      (a) =>
        a.role !== 'none' &&
        !a.complianceFlags.some((f) => BLOCKING_FLAGS.has(f)) &&
        (!a.validFrom || a.validFrom <= at) &&
        (!a.validTo || at < a.validTo),
    )
  return live?.leadRouting === 'dealer' ? 'dealer' : 'alpha'
}

/** Queues one lead email (unique per key) and its delivery job. */
async function queueLeadEmail(
  payload: Payload,
  lead: { id: number; number: string },
  template: LeadNotificationTemplate,
  to: string,
  locale: LocaleCode,
  key: string,
): Promise<void> {
  try {
    const doc = await payload.create({
      collection: 'notifications',
      data: {
        key,
        lead: lead.id,
        template,
        channel: 'email',
        locale,
        to,
        status: 'queued',
        attempts: 0,
      },
      ...system,
    })
    await payload.jobs.queue({
      task: SEND_NOTIFICATION,
      input: { notification: Number(doc.id) },
      queue: NOTIFICATIONS_QUEUE,
    })
  } catch (error) {
    const { totalDocs } = await payload.count({
      collection: 'notifications',
      where: { key: { equals: key } },
      // System read: see the module comment.
      overrideAccess: true,
    })
    if (totalDocs === 0) throw error
  }
}

// ── The storefront enquiry ───────────────────────────────────────────────────────────────────

export interface EnquiryInput {
  market: string
  locale: LocaleCode
  productSlug: string
  name: unknown
  email: unknown
  phone: unknown
  city: unknown
  message: unknown
  consent: unknown
  /** The honeypot field: people leave it empty. */
  website: unknown
  ip: string | null
  /** One per rendered form, so a double submit makes one lead. */
  idempotencyKey: unknown
}

export type EnquiryResult =
  | { status: 'sent'; number: string }
  | { status: 'invalid'; fields: string[] }
  | { status: 'rate-limited' | 'not-found' }

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/**
 * Records a storefront enquiry for a product on sale in the market and queues its routing. A
 * filled honeypot answers `sent` without recording anything (bots learn nothing).
 */
export async function submitEnquiry(
  payload: Payload,
  input: EnquiryInput,
  now: () => Date = () => new Date(),
): Promise<EnquiryResult> {
  const name = text(input.name, 120)
  const email = normaliseEmail(input.email)
  const phone = text(input.phone, 30)
  const city = text(input.city, 80)
  const message = text(input.message, 2000)
  const key = text(input.idempotencyKey, 100)
  const fields = [
    ...(name ? [] : ['name']),
    ...(email ? [] : ['email']),
    ...(phone === '' || /^\+?[\d\s()-]{6,30}$/.test(phone) ? [] : ['phone']),
    ...(input.consent === 'on' || input.consent === true ? [] : ['consent']),
    ...(/^[\w-]{8,100}$/.test(key) ? [] : ['form']),
  ]
  if (text(input.website, 200)) return { status: 'sent', number: '' }
  if (fields.length) return { status: 'invalid', fields }

  const at = now()
  const { docs } = await payload.find({
    collection: 'products',
    where: { slug: { equals: input.productSlug } },
    limit: 1,
    depth: 0,
    draft: false,
    // Published products only (access) — the shopper is anonymous.
    overrideAccess: false,
    select: { brand: true, markets: true, title: true },
  })
  const product = docs[0] as unknown as
    | {
        id: number
        brand?: number | { id: number } | null
        markets?: Array<{ market: string; published?: boolean | null }> | null
      }
    | undefined
  const brand = product ? idOf(product.brand ?? null) : null
  const sellable = brandsSellableIn(await loadRightsWindows(payload), input.market, at)
  if (!product || !publishedIn(product.markets, input.market) || !sellable.has(String(brand)))
    return { status: 'not-found' }

  const ipHash = input.ip
    ? createHmac('sha256', payload.secret).update(`lead-ip:${input.ip}`).digest('hex')
    : null
  const since = new Date(at.getTime() - HOUR).toISOString()
  const [forEmail, forIp] = await Promise.all([
    payload.count({
      collection: 'leads',
      where: {
        and: [{ 'contact.email': { equals: email } }, { createdAt: { greater_than: since } }],
      },
      ...system,
    }),
    ipHash
      ? payload.count({
          collection: 'leads',
          where: {
            and: [{ requestIpHash: { equals: ipHash } }, { createdAt: { greater_than: since } }],
          },
          ...system,
        })
      : Promise.resolve({ totalDocs: 0 }),
  ])
  if (leadLimit({ forEmail: forEmail.totalDocs, forIp: forIp.totalDocs }) !== 'ok')
    return { status: 'rate-limited' }

  const service = createLeads(payload, now)
  const created = await service.create({
    market: input.market,
    routing: await routingFor(payload, brand, input.market, at),
    city: city || null,
    idempotencyKey: `enquiry:${key}`,
    details: {
      source: 'specialist',
      locale: input.locale,
      brand,
      product: product.id,
      message: message || null,
      contact: { name, email: email ?? '', phone: phone || null },
      consent: true,
      requestIpHash: ipHash,
    },
  })
  if (created.created) {
    await queueLeadEmail(
      payload,
      { id: Number(created.lead.id), number: created.lead.number },
      'lead-received',
      email ?? '',
      input.locale,
      `${created.lead.number}:lead-received`,
    )
    await payload.jobs.queue({
      task: ROUTE_LEAD,
      input: { lead: created.lead.number },
      queue: LEADS_QUEUE,
    })
  }
  return { status: 'sent', number: created.lead.number }
}

// ── Routing (jobs) ───────────────────────────────────────────────────────────────────────────

/**
 * Routes a `new` lead and emails the company it is offered to (the `routeLead` job). Safe to run
 * twice: only one run moves the lead out of `new`.
 */
export async function routeLead(
  payload: Payload,
  number: string,
  now?: () => Date,
): Promise<'offered' | 'with-alpha' | 'skipped'> {
  const service = createLeads(payload, now)
  const store = new PostgresLeadStore(payload)
  const current = await store.findByNumber(number)
  if (!current) return 'skipped'
  const result = await service.route(number, await candidates(payload, current.market))
  if (!result.ok) return 'skipped'
  if (result.to.kind === 'alpha') {
    payload.logger.info({ msg: 'lead_routed', lead: number, to: 'alpha' })
    return 'with-alpha'
  }
  payload.logger.info({ msg: 'lead_routed', lead: number, to: result.to.id })
  const { docs } = await payload.find({
    collection: 'company-users',
    where: {
      and: [
        { company: { equals: Number(result.to.id) } },
        { role: { in: ['owner', 'purchaser'] } },
      ],
    },
    limit: 20,
    ...system,
  })
  const attempt = result.lead.attempts.length
  for (const user of docs as unknown as Array<{ email: string; locale?: string | null }>) {
    await queueLeadEmail(
      payload,
      { id: Number(result.lead.id), number },
      'lead-offered',
      user.email,
      user.locale === 'ar' ? 'ar' : 'en',
      `${number}:lead-offered:${attempt}:${user.email}`,
    )
  }
  return 'offered'
}

/** Expires offers past their deadline and queues their next routing (every 5 minutes). */
export async function rerouteExpiredLeads(payload: Payload, now?: () => Date): Promise<number> {
  const expired = await createLeads(payload, now).expireOffers()
  for (const number of expired) {
    payload.logger.info({ msg: 'lead_offer_expired', lead: number })
    await payload.jobs.queue({ task: ROUTE_LEAD, input: { lead: number }, queue: LEADS_QUEUE })
  }
  return expired.length
}

// ── For the signed-in company user ───────────────────────────────────────────────────────────

const canAct = (user: unknown) =>
  ['owner', 'purchaser'].includes(String((user as { role?: unknown } | null)?.role ?? ''))

/** The offered company accepts its lead (owners and purchasers). */
export async function acceptLead(
  payload: Payload,
  user: unknown,
  number: string,
  now?: () => Date,
): Promise<LeadActionResult | { ok: false; reason: 'forbidden' }> {
  const company = companyOf(user)
  if (company === null) return { ok: false, reason: 'not-found' }
  if (!canAct(user)) return { ok: false, reason: 'forbidden' }
  const result = await createLeads(payload, now).accept(number, company)
  if (result.ok) payload.logger.info({ msg: 'lead_accepted', lead: number, company })
  return result
}

/** The offered company passes; the lead is routed to the next company. */
export async function declineLead(
  payload: Payload,
  user: unknown,
  number: string,
  now?: () => Date,
): Promise<LeadActionResult | { ok: false; reason: 'forbidden' }> {
  const company = companyOf(user)
  if (company === null) return { ok: false, reason: 'not-found' }
  if (!canAct(user)) return { ok: false, reason: 'forbidden' }
  const result = await createLeads(payload, now).decline(number, company)
  if (result.ok)
    await payload.jobs.queue({ task: ROUTE_LEAD, input: { lead: number }, queue: LEADS_QUEUE })
  return result
}

/** The accepting company records the outcome (won with a value in minor units, or lost). */
export async function closeLead(
  payload: Payload,
  user: unknown,
  number: string,
  outcome: LeadOutcome,
  value: bigint | null,
): Promise<LeadActionResult | { ok: false; reason: 'forbidden' }> {
  const company = companyOf(user)
  if (company === null) return { ok: false, reason: 'not-found' }
  if (!canAct(user)) return { ok: false, reason: 'forbidden' }
  return createLeads(payload).close(number, company, outcome, value)
}
