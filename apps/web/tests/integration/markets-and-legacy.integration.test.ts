import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import {
  LEGACY_REDIRECTS_SLUG,
  MARKETS_SLUG,
  getMarketsCached,
  invalidateMarketsCache,
  loadMarkets,
  resolveLegacyRedirect,
  ensureStaffUser,
  seedMarkets,
} from '@alpha/payload'
import { createTestDatabase, type TestDatabase } from './helpers/database'
import { bootPayload } from './helpers/payload'

/**
 * Integration: the Markets global, its seed, LegacyRedirects and the resolvers the proxy uses,
 * on a fresh database migrated with the committed migrations.
 */
let db: TestDatabase
let payload: Payload
const scripted = { disableRevalidate: true } // no Next.js request here, so no revalidatePath

beforeAll(async () => {
  db = await createTestDatabase()
  payload = await bootPayload(db.url)
})

afterAll(async () => {
  // Payload's destroy() leaves the pg pool open. DROP DATABASE … WITH (FORCE) terminates its
  // connections, which the pool reports as errors; they are expected here.
  // reason: the Postgres adapter keeps its pg Pool on `pool`; the base adapter type omits it
  const pool = (payload?.db as unknown as { pool?: import('pg').Pool } | undefined)?.pool
  pool?.on('error', () => {})
  await payload?.destroy()
  await db?.drop()
  await Promise.race([pool?.end(), new Promise((resolve) => setTimeout(resolve, 2_000))])
})

/** Payload reports field validation messages in `error.data.errors`, not in `error.message`. */
async function expectFieldError(action: Promise<unknown>, message: RegExp) {
  const error = await action.then(
    () => null,
    (e: unknown) => e,
  )
  expect(error, 'expected a validation error').not.toBeNull()
  const messages = (
    (error as { data?: { errors?: Array<{ message?: string }> } }).data?.errors ?? []
  ).map((e) => e.message ?? '')
  expect(messages.join('\n')).toMatch(message)
}

type Row = Record<string, unknown> & { code: string }

/**
 * Saves the Markets global the way the admin does: rows keep their ids, so each row's Arabic
 * name survives an English-locale save. `mutate` edits the rows read in English.
 */
async function saveMarkets(
  mutate: (rows: Row[]) => unknown[],
  as: 'staff' | 'anonymous' = 'staff',
) {
  const current = await payload.findGlobal({
    slug: MARKETS_SLUG,
    locale: 'en',
    depth: 0,
    overrideAccess: false, // the global is public; read as anyone
  })
  const rows = (current.markets ?? []) as unknown as Row[]
  return payload.updateGlobal({
    slug: MARKETS_SLUG,
    locale: 'en',
    data: { markets: mutate(rows) } as never, // reason: tests also send deliberately invalid rows
    context: scripted,
    ...(as === 'staff' ? { user: await staff() } : {}),
    overrideAccess: false,
  })
}

const setStatus = (code: string, status: string) => (rows: Row[]) =>
  rows.map((r) => (r.code === code ? { ...r, status } : r))

const staff = () =>
  ensureStaffUser(payload, { email: 'staff@alpha.test', password: 'integration-password-1' })

describe('migrations', () => {
  it('apply in order on a fresh database', async () => {
    const { docs } = await payload.find({
      collection: 'payload-migrations',
      sort: 'createdAt',
      user: await staff(),
      overrideAccess: false,
    })
    expect(docs.map((d) => d.name)).toEqual([
      '20261014_023806_initial_schema',
      '20261014_023807_pgvector',
      '20261014_093836_markets_and_legacy_redirects',
    ])
  })
})

describe('Markets seed', () => {
  it('writes all six markets with English and Arabic names', async () => {
    expect(await seedMarkets(payload)).toEqual({
      added: ['ae', 'sa', 'qa', 'kw', 'bh', 'om'],
      kept: [],
    })
    const markets = await loadMarkets(payload)
    expect(markets.map((m) => m.code)).toEqual(['ae', 'sa', 'qa', 'kw', 'bh', 'om'])
    expect(markets.find((m) => m.code === 'om')?.name).toEqual({ en: 'Oman', ar: 'عُمان' })
    expect(markets.find((m) => m.code === 'kw')).toMatchObject({
      currency: 'KWD',
      decimals: 3,
      vatRate: 0,
    })
    expect(markets.filter((m) => m.status === 'live').map((m) => m.code)).toEqual(['ae'])
  })

  it('is idempotent and never overwrites a change made in the admin', async () => {
    await saveMarkets(setStatus('sa', 'live'))

    expect(await seedMarkets(payload)).toEqual({
      added: [],
      kept: ['ae', 'sa', 'qa', 'kw', 'bh', 'om'],
    })
    const after = await loadMarkets(payload)
    expect(after.find((m) => m.code === 'sa')?.status).toBe('live')
    expect(after.find((m) => m.code === 'sa')?.name.ar).toBe('المملكة العربية السعودية')
  })

  it('adds only a market that went missing, keeping the rest', async () => {
    await saveMarkets((rows) => rows.filter((r) => r.code !== 'bh'))
    expect(await seedMarkets(payload)).toMatchObject({ added: ['bh'] })
    const after = await loadMarkets(payload)
    expect(after.map((m) => m.code).sort()).toEqual(['ae', 'bh', 'kw', 'om', 'qa', 'sa'])
    expect(after.find((m) => m.code === 'sa')?.status).toBe('live')
    expect(after.find((m) => m.code === 'bh')?.name.ar).toBe('البحرين')
  })
})

describe('Markets global rules', () => {
  it('rejects decimals that do not match the currency', async () => {
    await expectFieldError(
      saveMarkets((rows) => rows.map((r) => (r.code === 'kw' ? { ...r, decimals: 2 } : r))),
      /KWD has 3 decimal places/,
    )
  })

  it('rejects a duplicate market code', async () => {
    await expectFieldError(
      saveMarkets((rows) => [...rows, { ...rows[0], id: undefined, name: 'Again' }]),
      /appears more than once/,
    )
  })

  it('rejects an unknown time zone', async () => {
    await expectFieldError(
      saveMarkets((rows) =>
        rows.map((r) => (r.code === 'ae' ? { ...r, timezone: 'Asia/Atlantis' } : r)),
      ),
      /IANA time zone/,
    )
  })

  it('is publicly readable but only staff can change it', async () => {
    const read = await payload.findGlobal({ slug: MARKETS_SLUG, overrideAccess: false })
    expect(read.markets?.length).toBe(6)
    await expect(saveMarkets((rows) => rows, 'anonymous')).rejects.toThrow(/not allowed/i)
  })

  it('clears the process-wide cache when saved', async () => {
    invalidateMarketsCache()
    expect((await getMarketsCached(payload)).find((m) => m.code === 'qa')?.status).toBe('soon')
    await saveMarkets(setStatus('qa', 'live'))
    expect((await getMarketsCached(payload)).find((m) => m.code === 'qa')?.status).toBe('live')
  })

  it('keeps loading when a market has no Arabic name yet', async () => {
    // A brand-new row written in English only, as an editor would add it.
    await saveMarkets((rows) =>
      rows.map((r) => (r.code === 'om' ? { ...r, id: undefined, name: 'Oman (new row)' } : r)),
    )
    const om = (await loadMarkets(payload)).find((m) => m.code === 'om')
    expect(om?.name).toEqual({ en: 'Oman (new row)', ar: 'Oman (new row)' })
  })
})

describe('LegacyRedirects', () => {
  const create = async (data: Record<string, unknown>) =>
    payload.create({
      collection: LEGACY_REDIRECTS_SLUG,
      data: data as never, // reason: raw editor input, normalised by the collection's hook
      user: await staff(),
      overrideAccess: false,
    })
  const resolve = (path: string) =>
    resolveLegacyRedirect(payload, new URL(path, 'https://alphaaudios.com'))

  it('normalises what editors type', async () => {
    const doc = await create({
      sourcePath: '/Brand/',
      sourceQuery: '?BID=13&utm_source=x',
      target: '/ae/en/brands/mcintosh/',
    })
    expect(doc).toMatchObject({ sourcePath: '/brand', sourceQuery: 'bid=13', status: '301' })
  })

  it('resolves however the old link was shared', async () => {
    for (const path of [
      '/brand?bid=13',
      '/BRAND/?BID=13',
      '/brand?utm_campaign=x&bid=13&gclid=y',
    ]) {
      expect(await resolve(path)).toEqual({ target: '/ae/en/brands/mcintosh/', status: 301 })
    }
    expect(await resolve('/brand?bid=14')).toBeNull()
    expect(await resolve('/collection?bid=13')).toBeNull()
  })

  it('matches a stored multi-key query in any order and honours 302', async () => {
    await create({
      sourcePath: '/collection',
      sourceQuery: 'catid=53&bid=13',
      target: '/ae/en/brands/mcintosh/amplifiers/',
      status: '302',
    })
    expect(await resolve('/collection?bid=13&catid=53')).toEqual({
      target: '/ae/en/brands/mcintosh/amplifiers/',
      status: 302,
    })
  })

  it('matches a path-only row whether its query was saved empty or left unset', async () => {
    await create({ sourcePath: '/about-us.html', target: '/ae/en/about/' })
    await create({ sourcePath: '/contact.html', sourceQuery: '', target: '/ae/en/contact/' })
    expect(await resolve('/about-us.html')).toMatchObject({ target: '/ae/en/about/' })
    expect(await resolve('/contact.html?utm_source=x')).toMatchObject({ target: '/ae/en/contact/' })
  })

  it('refuses a duplicate source and an off-site target', async () => {
    await expect(
      create({ sourcePath: '/brand', sourceQuery: 'bid=13', target: '/ae/en/' }),
    ).rejects.toThrow()
    await expectFieldError(
      create({ sourcePath: '/brand', sourceQuery: 'bid=99', target: 'https://evil.example/' }),
      /path on this site/,
    )
  })

  it('is readable by anyone, writable only by staff', async () => {
    const { docs } = await payload.find({
      collection: LEGACY_REDIRECTS_SLUG,
      overrideAccess: false,
    })
    expect(docs.length).toBeGreaterThan(0)
    await expect(
      payload.create({
        collection: LEGACY_REDIRECTS_SLUG,
        data: { sourcePath: '/x', target: '/ae/en/' } as never, // reason: status left to its default
        overrideAccess: false,
      }),
    ).rejects.toThrow(/not allowed/i)
  })
})

describe('proxy lookups (apps/web/src/lib)', () => {
  it('lookupLegacy carries campaign parameters to the target', async () => {
    const { lookupLegacy } = await import('../../src/lib/legacy')
    expect(
      await lookupLegacy(new URL('https://alphaaudios.com/brand?bid=13&utm_source=ig&fbclid=z')),
    ).toEqual({
      location: '/ae/en/brands/mcintosh/?utm_source=ig&fbclid=z',
      status: 301,
    })
    expect(await lookupLegacy(new URL('https://alphaaudios.com/brand?bid=999'))).toBeNull()
  })

  it('isRoutableMarket follows the record', async () => {
    invalidateMarketsCache()
    const { isRoutableMarket } = await import('../../src/lib/marketCheck')
    expect(await isRoutableMarket('ae', 'ar')).toBe(true)
    expect(await isRoutableMarket('qa', 'en')).toBe(true) // set live above
    expect(await isRoutableMarket('om', 'en')).toBe(false)
    expect(await isRoutableMarket('ae', 'fr')).toBe(false)
  })
})
