import { beforeAll, describe, expect, it, vi } from 'vitest'
import { sql } from '@payloadcms/db-postgres/drizzle'
import { deliverNotification, sessionCsrf, type OutgoingEmail } from '@alpha/payload'
import { ORIGIN, form, placeOrder, seedShop } from './helpers/commerce'
import { db, staff } from './helpers/ledger'
import { usePayload } from './helpers/suite'

vi.mock('next/cache', () => ({ unstable_cache: <T>(fn: T) => fn, revalidateTag: () => undefined }))

/**
 * Task 0012: My Alpha sign-in by email link, sessions, sign-out with CSRF, and what a customer
 * may read (own customer record, own orders and shipments, no staff fields).
 */
const payload = usePayload()
let account: typeof import('@/lib/api/account')
let ops: typeof import('@/lib/api/opsOrders')

const rows = async (query: ReturnType<typeof sql>) =>
  (await db(payload()).execute(query)).rows as Array<Record<string, unknown>>

/** Asks for a link and returns the emailed URL (the job's email, captured). */
async function signInLink(
  email: string,
  ip = '203.0.113.7',
): Promise<{ status: string; link: string | null }> {
  const res = await account.postSignIn(
    { payload: payload(), defer: () => undefined },
    form('/api/v1/markets/ae/account/sign-in', { email, locale: 'en' }, { 'cf-connecting-ip': ip }),
    'ae',
  )
  const status = new URL(res.headers.get('location') ?? '', ORIGIN).searchParams.get('status') ?? ''
  const [row] = await rows(
    sql`SELECT id FROM notifications WHERE template = 'sign-in' AND "to" = ${email.trim().toLowerCase()} AND status = 'queued' ORDER BY id DESC LIMIT 1`,
  )
  if (!row) return { status, link: null }
  const sent: OutgoingEmail[] = []
  await deliverNotification(payload(), Number(row['id']), async (e) => void sent.push(e))
  return { status, link: /Sign in: (\S+)/.exec(sent[0]?.text ?? '')?.[1] ?? null }
}

async function verify(link: string, now?: Date) {
  const token = new URL(link).searchParams.get('token') ?? ''
  const res = await account.postVerify(
    { payload: payload(), ...(now ? { now: () => now } : {}) },
    form('/api/v1/markets/ae/account/verify', { token, locale: 'en' }),
    'ae',
  )
  const cookie = res.headers.get('set-cookie')
  return {
    location: res.headers.get('location') ?? '',
    cookie: cookie ? (cookie.split(';')[0] ?? '') : null,
    raw: cookie,
  }
}

async function signIn(email: string) {
  const { link } = await signInLink(email)
  if (!link) throw new Error('no sign-in email')
  const { cookie } = await verify(link)
  if (!cookie) throw new Error('no session')
  const { user } = await payload().auth({ headers: new Headers({ cookie }) })
  if (!user) throw new Error('session not recognised')
  return { cookie, user }
}

beforeAll(async () => {
  account = await import('@/lib/api/account')
  ops = await import('@/lib/api/opsOrders')
  await seedShop(payload(), 'acc-brand', [{ sku: 'ACC-AMP', price: 1_050_000, qty: 20 }])
})

describe('sign-in links', () => {
  it('emails a one-time link and never stores it in the clear', async () => {
    const { status, link } = await signInLink('  Noor@Example.com ')
    expect(status).toBe('sent')
    expect(link).toMatch(/^http:\/\/localhost:3000\/ae\/en\/account\/verify\/\?token=[\w-]{43}$/)
    const token = new URL(link ?? '').searchParams.get('token') ?? ''
    const stored = await rows(
      sql`SELECT token_hash FROM sign_in_links WHERE email = 'noor@example.com'`,
    )
    expect(stored.map((r) => r['token_hash'])).not.toContain(token)
    const outbox = await rows(
      sql`SELECT secret FROM notifications WHERE template = 'sign-in' AND "to" = 'noor@example.com'`,
    )
    expect(outbox.every((r) => r['secret'] === null)).toBe(true)
  })

  it('answers the same for an unknown address, and refuses bad input and cross-site posts', async () => {
    expect((await signInLink('nobody-yet@example.com')).status).toBe('sent')
    expect((await signInLink('not-an-email')).status).toBe('invalid-email')
    const cross = await account.postSignIn(
      { payload: payload() },
      form(
        '/api/v1/markets/ae/account/sign-in',
        { email: 'x@example.com', locale: 'en' },
        { origin: 'https://evil.example' },
      ),
      'ae',
    )
    expect(cross.status).toBe(403)
  })

  it('limits links per address per hour', async () => {
    for (let i = 0; i < 5; i++)
      expect((await signInLink('busy@example.com', `198.51.100.${i}`)).status).toBe('sent')
    expect((await signInLink('busy@example.com', '198.51.100.99')).status).toBe('rate-limited')
  })

  it('starts a session once per link, never after it expires', async () => {
    const first = await signInLink('layla@example.com')
    const used = await verify(first.link ?? '')
    expect(used.location).toBe('/ae/en/account/orders/')
    expect(used.raw).toMatch(
      /^alpha_session=[\w-]{43}; Path=\/; Expires=.+; HttpOnly; SameSite=Lax$/,
    )
    expect((await verify(first.link ?? '')).location).toBe('/ae/en/account/?status=used')

    const second = await signInLink('layla@example.com')
    const late = await verify(second.link ?? '', new Date(Date.now() + 16 * 60_000))
    expect(late).toMatchObject({ location: '/ae/en/account/?status=expired', cookie: null })
    expect(
      (await verify('http://localhost:3000/ae/en/account/verify/?token=forged')).location,
    ).toBe('/ae/en/account/?status=unknown')
    expect(
      await rows(sql`SELECT id FROM customers WHERE email = 'layla@example.com'`),
    ).toHaveLength(1)
  })
})

describe('what a customer can read', () => {
  it('sees their own orders and shipments, never another customer’s, and no staff fields', async () => {
    const mine = await placeOrder(payload(), [{ sku: 'ACC-AMP', qty: 1 }], 'mariam@example.com')
    const theirs = await placeOrder(payload(), [{ sku: 'ACC-AMP', qty: 1 }], 'omar@example.com')
    const { token } = await payload().login({
      collection: 'users',
      data: { email: (await staff(payload())).email, password: 'integration-password-1' },
    })
    const staffHeaders = { origin: ORIGIN, authorization: `JWT ${token}` }
    for (const step of ['pick', 'ship'] as const) {
      await ops.postOrderAction(
        { payload: payload() },
        form(
          `/api/v1/ops/orders/${mine.number}/${step}`,
          { courier: 'Aramex', trackingNumber: 'TRK12345' },
          staffHeaders,
        ),
        mine.number,
        step,
      )
    }
    await payload().update({
      collection: 'orders',
      where: { number: { equals: mine.number } },
      data: { notes: 'VIP, call first' },
      user: await staff(payload()),
      overrideAccess: false,
    })

    const { user } = await signIn('Mariam@example.com')
    const orders = await payload().find({
      collection: 'orders',
      depth: 1,
      user,
      overrideAccess: false,
    })
    expect(orders.docs.map((o) => o.number)).toEqual([mine.number])
    const order = orders.docs[0]
    expect(order?.notes).toBeUndefined()
    expect(order?.idempotencyKey).toBeUndefined()
    expect(order?.payment?.intentId).toBeUndefined()
    expect(order?.shipment).toMatchObject({ courier: 'Aramex', trackingNumber: 'TRK12345' })
    await expect(
      payload().find({
        collection: 'orders',
        where: { number: { equals: theirs.number } },
        user,
        overrideAccess: false,
      }),
    ).resolves.toMatchObject({ totalDocs: 0 })
    expect(
      (await payload().find({ collection: 'shipments', user, overrideAccess: false })).totalDocs,
    ).toBe(1)

    const customers = await payload().find({ collection: 'customers', user, overrideAccess: false })
    expect(customers.docs.map((c) => c.email)).toEqual(['mariam@example.com'])
    await expect(
      payload().update({
        collection: 'customers',
        id: user.id,
        data: { name: 'x' },
        user,
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('gives nothing to an anonymous visitor', async () => {
    for (const collection of ['customers', 'customer-sessions', 'sign-in-links'] as const) {
      await expect(payload().find({ collection, overrideAccess: false })).rejects.toMatchObject({
        status: 403,
      })
    }
    await expect(
      payload().find({ collection: 'orders', overrideAccess: false }),
    ).rejects.toMatchObject({ status: 403 })
    const { user } = await payload().auth({
      headers: new Headers({ cookie: 'alpha_session=forged-token' }),
    })
    expect(user).toBeNull()
  })
})

describe('sign-out', () => {
  it('needs the session’s CSRF token, then ends the session and clears the cookie', async () => {
    const { cookie } = await signIn('hessa@example.com')
    const out = (fields: Record<string, string>) =>
      account.postSignOut(
        { payload: payload() },
        form('/api/v1/markets/ae/account/sign-out', { locale: 'en', ...fields }, { cookie }),
        'ae',
      )
    expect((await out({ csrf: 'wrong' })).status).toBe(403)
    expect((await payload().auth({ headers: new Headers({ cookie }) })).user).not.toBeNull()

    const session = decodeURIComponent(cookie.split('=')[1] ?? '')
    const res = await out({ csrf: sessionCsrf(payload(), session) })
    expect(res.headers.get('location')).toBe('/ae/en/account/?status=signed-out')
    expect(res.headers.get('set-cookie')).toMatch(
      /^alpha_session=; Path=\/; Max-Age=0; HttpOnly; SameSite=Lax$/,
    )
    expect((await payload().auth({ headers: new Headers({ cookie }) })).user).toBeNull()
  })
})
