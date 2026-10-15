import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { TypedUser } from 'payload'
import {
  createQuoteFromDraft,
  decideProject,
  placeTradeOrder,
  previewTradeOrder,
  registerProject,
  withdrawProject,
} from '@alpha/payload'
import { ORIGIN, form } from './helpers/commerce'
import { staff } from './helpers/ledger'
import { usePayload } from './helpers/suite'
import { seedTrade, type TradeFixture } from './helpers/trade'

vi.mock('next/cache', () => ({ unstable_cache: <T>(fn: T) => fn, revalidateTag: () => undefined }))

/**
 * Task 0017: project registrations — register, staff decision, project prices in orders and
 * quotes (after contracts), refusal of other companies' or unusable projects, and isolation.
 */
const payload = usePayload()
let t: TradeFixture
let keys = 0
const inDays = (n: number) => new Date(Date.now() + n * 24 * 3600_000).toISOString().slice(0, 10)

const register = (user: unknown, lines: Array<{ sku: string; qty: number }>) =>
  registerProject(payload(), user, {
    idempotencyKey: `project-${++keys}`,
    name: 'Palm villa cinema',
    endCustomer: 'Private client',
    city: 'Dubai',
    expectedClose: inDays(45),
    note: 'Competing with one other integrator',
    lines,
    locale: 'en',
  })
const numberOf = (r: Awaited<ReturnType<typeof register>>) => (r?.ok ? r.project.number : '')
const order = (user: unknown, project: string | null, sku: string, qty = 1) =>
  placeTradeOrder(payload(), user, {
    lines: [{ sku, qty }],
    idempotencyKey: `order-${++keys}`,
    project,
    locale: 'en',
  })

let approved = ''

beforeAll(async () => {
  t = await seedTrade(payload(), 'pr')
  const placed = await register(t.alphaOwner, [
    { sku: t.skus.amp, qty: 4 },
    { sku: t.skus.spk, qty: 10 },
  ])
  approved = numberOf(placed)
  const decided = await decideProject(payload(), await staff(payload()), approved, {
    decision: 'approve',
    // The amplifier also has a contract (6,900.00), which comes first.
    prices: { [t.skus.spk]: 350_000n, [t.skus.amp]: 650_000n },
    validityDays: 30,
    note: 'Approved: Palm villa',
  })
  if (!decided.ok) throw new Error(`approval failed: ${decided.reason}`)
})

describe('the ops review endpoint', () => {
  it('approves with prices typed in the market currency, staff only', async () => {
    const ops = await import('@/lib/api/opsProjects')
    const number = numberOf(await register(t.alphaOwner, [{ sku: t.skus.spk, qty: 3 }]))
    const { token } = await payload().login({
      collection: 'users',
      data: { email: (await staff(payload())).email, password: 'integration-password-1' },
    })
    const post = (fields: Record<string, string>, headers: Record<string, string>) =>
      ops.postProjectDecision(
        { payload: payload() },
        form(`/api/v1/ops/projects/${number}/decide`, fields, headers),
        number,
        'decide',
      )
    const staffHeaders = { origin: ORIGIN, authorization: `JWT ${token}` }
    const bad = await post({ decision: 'approve', [`price:${t.skus.spk}`]: '12.345' }, staffHeaders)
    expect(bad.headers.get('location')).toBe(
      `/ops/projects/${encodeURIComponent(number)}/?result=invalid-price`,
    )
    const ok = await post(
      { decision: 'approve', [`price:${t.skus.spk}`]: '3,200.50', validityDays: '60', note: 'OK' },
      staffHeaders,
    )
    expect(ok.headers.get('location')).toBe(
      `/ops/projects/?result=approved&project=${encodeURIComponent(number)}`,
    )
    const stored = await payload().find({
      collection: 'project-registrations',
      where: { number: { equals: number } },
      user: await staff(payload()),
      overrideAccess: false,
    })
    expect(stored.docs[0]?.lines?.[0]?.projectPrice).toBe(320_050)
    const anonymous = await post({ decision: 'reject' }, { origin: ORIGIN })
    expect(anonymous.headers.get('location')).toMatch(/^\/admin\/login\?redirect=/)
  })
})

describe('project registrations', () => {
  it('registers a project for staff review, and only staff decide', async () => {
    const placed = await register(t.alphaOwner, [{ sku: t.skus.amp, qty: 1 }])
    expect(placed).toMatchObject({
      ok: true,
      project: {
        status: 'submitted',
        lines: [{ sku: t.skus.amp, price: null, title: `${t.skus.amp} title` }],
      },
    })
    expect(
      await decideProject(payload(), t.alphaOwner, numberOf(placed), { decision: 'reject' }),
    ).toEqual({
      ok: false,
      reason: 'forbidden',
    })
    expect(await register(t.alphaViewer, [{ sku: t.skus.amp, qty: 1 }])).toEqual({
      ok: false,
      reason: 'not-allowed',
    })
    expect(await register(t.alphaOwner, [{ sku: 'PR-NOPE', qty: 1 }])).toMatchObject({
      ok: false,
      reason: 'invalid',
      problems: ['unknown-product'],
    })
  })

  it('prices orders and quotes for the project at project prices, after contracts', async () => {
    const preview = await previewTradeOrder(
      payload(),
      t.alphaOwner,
      [
        { sku: t.skus.spk, qty: 2 },
        { sku: t.skus.amp, qty: 1 },
      ],
      { locale: 'en', project: approved },
    )
    expect(preview).toMatchObject({
      project: { number: approved, name: 'Palm villa cinema' },
      projectUnavailable: false,
      lines: [
        { sku: t.skus.spk, basis: 'project', unit: { amount: 350_000n } },
        { sku: t.skus.amp, basis: 'contract', unit: { amount: 690_000n } },
      ],
    })
    expect(preview?.lines[0]?.trace.find((s) => s.rule === 'project')).toEqual({
      rule: 'project',
      seen: true,
      matched: true,
      value: '3500.00',
    })
    const placed = await order(t.alphaOwner, approved, t.skus.spk, 2)
    expect(placed).toMatchObject({
      ok: true,
      order: { status: 'confirmed', lines: [{ basis: 'project', unit: { amount: 350_000n } }] },
    })
    const stored = await payload().find({
      collection: 'trade-orders',
      where: {
        number: { equals: placed && 'order' in placed && placed.order ? placed.order.number : '' },
      },
      user: await staff(payload()),
      overrideAccess: false,
    })
    expect(stored.docs[0]?.project).toBe(approved)
    expect(await order(t.alphaOwner, null, t.skus.spk)).toMatchObject({
      ok: true,
      order: { lines: [{ basis: 'dealer-list', unit: { amount: 400_000n } }] },
    })
    const quoted = await createQuoteFromDraft(payload(), t.alphaOwner, {
      lines: [{ sku: t.skus.spk, qty: 1 }],
      idempotencyKey: `quote-${++keys}`,
      project: approved,
      locale: 'en',
    })
    expect(quoted).toMatchObject({
      ok: true,
      quote: { lines: [{ basis: 'project', unit: { amount: 350_000n } }] },
    })
  })

  it('refuses another company’s project and one that is rejected, withdrawn or expired', async () => {
    expect(await order(t.betaOwner, approved, t.skus.spk)).toEqual({
      ok: false,
      reason: 'project-unavailable',
    })
    expect(await order(t.alphaOwner, 'P-AE-2026-999999', t.skus.spk)).toEqual({
      ok: false,
      reason: 'project-unavailable',
    })
    const later = await previewTradeOrder(payload(), t.alphaOwner, [{ sku: t.skus.spk, qty: 1 }], {
      locale: 'en',
      project: approved,
      at: new Date(Date.now() + 31 * 24 * 3600_000),
    })
    expect(later).toMatchObject({
      projectUnavailable: true,
      lines: [{ basis: 'dealer-list' }],
    })

    const second = numberOf(await register(t.alphaOwner, [{ sku: t.skus.spk, qty: 1 }]))
    await decideProject(payload(), await staff(payload()), second, {
      decision: 'reject',
      note: 'Registered by another dealer',
    })
    expect(await order(t.alphaOwner, second, t.skus.spk)).toEqual({
      ok: false,
      reason: 'project-unavailable',
    })
    const third = numberOf(await register(t.alphaOwner, [{ sku: t.skus.spk, qty: 1 }]))
    await decideProject(payload(), await staff(payload()), third, {
      decision: 'approve',
      prices: { [t.skus.spk]: 300_000n },
    })
    expect(await withdrawProject(payload(), t.alphaViewer, third)).toEqual({
      ok: false,
      reason: 'forbidden',
    })
    expect(await withdrawProject(payload(), t.betaOwner, third)).toEqual({
      ok: false,
      reason: 'not-found',
    })
    expect(await withdrawProject(payload(), t.alphaOwner, third)).toMatchObject({
      ok: true,
      project: { status: 'withdrawn' },
    })
    expect(await order(t.alphaOwner, third, t.skus.spk)).toEqual({
      ok: false,
      reason: 'project-unavailable',
    })
  })

  it('keeps registrations and project prices within the company', async () => {
    const read = (user: TypedUser) =>
      payload().find({
        collection: 'project-registrations',
        user,
        overrideAccess: false,
        limit: 100,
      })
    const beta = await read(t.betaOwner)
    expect(beta.docs.map((p) => p.number)).not.toContain(approved)
    const alpha = await read(t.alphaViewer)
    const mine = alpha.docs.find((p) => p.number === approved)
    expect(mine?.lines?.find((l) => l.sku === t.skus.spk)?.projectPrice).toBe(350_000)
    expect(mine?.decisionNote).toBe('Approved: Palm villa')
    expect(mine?.decidedBy).toBeUndefined()
    expect(mine?.idempotencyKey).toBeUndefined()
    await expect(
      payload().find({ collection: 'project-registrations', overrideAccess: false }),
    ).rejects.toMatchObject({ status: 403 })
  })
})
