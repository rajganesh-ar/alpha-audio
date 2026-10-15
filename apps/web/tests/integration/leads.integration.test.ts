import { beforeAll, describe, expect, it, vi } from 'vitest'
import { sql } from '@payloadcms/db-postgres/drizzle'
import type { TypedUser } from 'payload'
import {
  acceptLead,
  closeLead,
  declineLead,
  renderNotification,
  rerouteExpiredLeads,
  routeLead,
  submitEnquiry,
  type EnquiryInput,
} from '@alpha/payload'
import { form } from './helpers/commerce'
import { db, staff } from './helpers/ledger'
import { usePayload } from './helpers/suite'
import { seedTrade, type TradeFixture } from './helpers/trade'

vi.mock('next/cache', () => ({ unstable_cache: <T>(fn: T) => fn, revalidateTag: () => undefined }))

/**
 * Task 0018: leads — the storefront enquiry, routing by agreement and territory, the 24-hour
 * acceptance with re-routing on decline and expiry, contact privacy until acceptance, outcomes
 * and the emails queued.
 */
const payload = usePayload()
let t: TradeFixture
let keys = 0

const as = async () => ({ user: await staff(payload()), overrideAccess: false }) as const
const enquiry = (overrides: Partial<EnquiryInput> = {}): EnquiryInput => ({
  market: 'ae',
  locale: 'en',
  productSlug: 'ld-amp',
  name: 'Mariam',
  email: `mariam+${++keys}@example.com`,
  phone: '+971 50 123 4567',
  city: 'Dubai',
  message: 'Looking for a system for the majlis.',
  consent: 'on',
  website: '',
  ip: `198.51.100.${keys}`,
  idempotencyKey: `enquiry-key-${keys}`,
  ...overrides,
})
const send = async (overrides: Partial<EnquiryInput> = {}) => {
  const result = await submitEnquiry(payload(), enquiry(overrides))
  if (result.status !== 'sent') throw new Error(`enquiry ${result.status}`)
  return result.number
}
const leadAs = async (user: TypedUser, number: string) =>
  (
    await payload().find({
      collection: 'leads',
      where: { number: { equals: number } },
      user,
      overrideAccess: false,
    })
  ).docs[0]
const setRouting = async (leadRouting: 'alpha' | 'dealer') =>
  payload().update({
    collection: 'brand-agreements',
    where: { market: { equals: 'ae' } },
    data: { leadRouting },
    ...(await as()),
  })

beforeAll(async () => {
  t = await seedTrade(payload(), 'ld')
  await setRouting('dealer')
  for (const [company, territories] of [
    [t.alpha.id, ['Dubai', 'Sharjah']],
    [t.beta.id, ['Abu Dhabi']],
  ] as const) {
    await payload().update({
      collection: 'companies',
      id: company,
      data: {
        territories: [...territories],
        settings: { stockVisibility: 'banded', acceptsLeads: true },
      },
      ...(await as()),
    })
  }
})

describe('the storefront enquiry', () => {
  it('records a lead and queues the acknowledgement and the routing', async () => {
    const number = await send()
    expect(number).toMatch(/^L-AE-2026-\d{6}$/)
    const { rows } = await db(payload()).execute(
      sql`SELECT template, "to" FROM notifications n JOIN leads l ON l.id = n.lead_id WHERE l.number = ${number}`,
    )
    expect(rows).toEqual([{ template: 'lead-received', to: `mariam+${keys}@example.com` }])
    const jobs = await db(payload()).execute(
      sql`SELECT input FROM payload_jobs WHERE task_slug = 'routeLead' AND input->>'lead' = ${number}`,
    )
    expect(jobs.rows).toHaveLength(1)
  })

  it('refuses bad input, ignores bots, limits floods and unknown products', async () => {
    expect(
      await submitEnquiry(payload(), enquiry({ email: 'nope', consent: '', phone: 'abc' })),
    ).toEqual({ status: 'invalid', fields: ['email', 'phone', 'consent'] })
    expect(await submitEnquiry(payload(), enquiry({ website: 'http://spam.example' }))).toEqual({
      status: 'sent',
      number: '',
    })
    expect(await submitEnquiry(payload(), enquiry({ productSlug: 'no-such' }))).toEqual({
      status: 'not-found',
    })
    for (let i = 0; i < 5; i++) await send({ email: 'busy@example.com' })
    expect(await submitEnquiry(payload(), enquiry({ email: 'busy@example.com' }))).toEqual({
      status: 'rate-limited',
    })
  })

  it('answers the form with 303 and refuses cross-site posts', async () => {
    const api = await import('@/lib/api/leads')
    const fields = {
      product: 'ld-amp',
      locale: 'ar',
      name: 'Omar',
      email: 'omar@example.com',
      consent: 'on',
      key: 'form-key-0001',
    }
    const ok = await api.postEnquiry(
      { payload: payload() },
      form('/api/v1/markets/ae/leads', fields),
      'ae',
    )
    expect(ok.status).toBe(303)
    expect(ok.headers.get('location')).toBe('/ae/ar/enquire/?product=ld-amp&status=sent')
    const cross = await api.postEnquiry(
      { payload: payload() },
      form('/api/v1/markets/ae/leads', fields, { origin: 'https://evil.example' }),
      'ae',
    )
    expect(cross.status).toBe(403)
  })
})

describe('routing and acceptance', () => {
  it('offers to the dealer covering the city, hiding the contact until it accepts', async () => {
    const number = await send({ city: 'dubai' })
    expect(await routeLead(payload(), number)).toBe('offered')
    expect(await routeLead(payload(), number)).toBe('skipped')
    const offered = await leadAs(t.alphaOwner, number)
    expect(offered).toMatchObject({ status: 'offered', city: 'dubai' })
    expect(offered?.contact).toBeUndefined()
    expect(offered?.attempts).toBeUndefined()
    expect(await leadAs(t.betaOwner, number)).toBeUndefined()

    const { rows } = await db(payload()).execute(
      sql`SELECT n.id, n."to" FROM notifications n JOIN leads l ON l.id = n.lead_id WHERE l.number = ${number} AND n.template = 'lead-offered'`,
    )
    expect(rows.map((r) => r['to'])).toEqual([`owner@ld-alpha.example`])
    const email = await renderNotification(payload(), Number(rows[0]?.['id']))
    expect(email?.email.text).toContain('LD-AMP title')
    expect(email?.email.text).not.toMatch(/mariam|\+971/)

    expect(await acceptLead(payload(), t.betaOwner, number)).toEqual({
      ok: false,
      reason: 'not-yours',
    })
    expect(await acceptLead(payload(), t.alphaViewer, number)).toEqual({
      ok: false,
      reason: 'forbidden',
    })
    expect(await acceptLead(payload(), t.alphaOwner, number)).toMatchObject({
      ok: true,
      lead: { status: 'accepted' },
    })
    const accepted = await leadAs(t.alphaViewer, number)
    expect(accepted?.contact).toMatchObject({ name: 'Mariam', phone: '+971 50 123 4567' })
    expect(await closeLead(payload(), t.alphaOwner, number, 'won', 2_500_000n)).toMatchObject({
      ok: true,
      lead: { status: 'closed', outcome: 'won', value: 2_500_000n },
    })
  })

  it('re-routes a declined or expired offer, recording every hop, then hands it to Alpha', async () => {
    const number = await send({ city: 'Abu Dhabi' })
    await routeLead(payload(), number)
    expect((await leadAs(t.betaOwner, number))?.status).toBe('offered')
    expect(await declineLead(payload(), t.betaOwner, number)).toMatchObject({ ok: true })
    expect(await leadAs(t.betaOwner, number)).toBeUndefined()
    expect(await routeLead(payload(), number)).toBe('offered')
    expect((await leadAs(t.alphaOwner, number))?.status).toBe('offered')

    const later = () => new Date(Date.now() + 25 * 3600_000)
    expect(await rerouteExpiredLeads(payload(), later)).toBeGreaterThanOrEqual(1)
    expect(await routeLead(payload(), number, later)).toBe('with-alpha')
    const final = await leadAs(await staff(payload()), number)
    expect(final).toMatchObject({ status: 'with-alpha' })
    expect(
      (final?.attempts as Array<{ company: number; result: string }>).map((a) => [
        a.company,
        a.result,
      ]),
    ).toEqual([
      [t.beta.id, 'declined'],
      [t.alpha.id, 'expired'],
    ])
  })

  it('keeps leads with Alpha when the brand’s agreement says so', async () => {
    await setRouting('alpha')
    const number = await send({ city: 'Dubai' })
    expect(await routeLead(payload(), number)).toBe('with-alpha')
    expect(await leadAs(t.alphaOwner, number)).toBeUndefined()
    await setRouting('dealer')
  })
})
