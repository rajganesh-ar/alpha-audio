/**
 * Local development and CI only: two demo trade companies in the UAE with dealer board users,
 * a contract price, a buyer group with a price list and a discount, a promotion and one product
 * below the margin floor, so the partners catalogue shows every price basis (docs/tasks/0014).
 * Run after the demo seeds (seed:markets, seed:inventory, seed:catalog):
 *
 *   pnpm --filter @alpha/web seed:trade
 *
 * Sign in on the partners app (http://localhost:3001) as one of the users in TRADE_USERS with
 * the password TRADE_PASSWORD. Refuses to run in production. Safe to re-run: it stops if the
 * first company exists.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { createProjects, ensureStaffUser } from '@alpha/payload'

const TRADE_PASSWORD = 'partners-demo-123'
const TRADE_USERS = {
  harmonyOwner: 'owner@harmony.example',
  harmonyArabic: 'arabic@harmony.example',
  harmonyViewer: 'viewer@harmony.example',
  harmonyBuyer: 'buyer@harmony.example',
  gulfOwner: 'owner@gulf-integrators.example',
} as const

if (process.env.NODE_ENV === 'production') {
  console.error('seed:trade is for local development and CI and refuses to run in production.')
  process.exit(1)
}

const payload = await getPayload({ config })
const user = await ensureStaffUser(payload, {
  email: 'dev@alpha.local',
  password: 'dev-password-123',
})
const as = () => ({ user, overrideAccess: false, context: { disableRevalidate: true } }) as const

const existing = await payload.find({
  collection: 'companies',
  where: { name: { equals: 'Harmony Systems LLC' } },
  ...as(),
})

/**
 * Dealer order settings (docs/tasks/0015), applied on every run so a database seeded before
 * dealer orders gets them too: Harmony's credit and a purchaser with an approval threshold, and
 * Gulf Integrators' order rules.
 */
async function orderSetup(): Promise<void> {
  const company = async (name: string) =>
    (await payload.find({ collection: 'companies', where: { name: { equals: name } }, ...as() }))
      .docs[0]
  const harmony = await company('Harmony Systems LLC')
  const gulf = await company('Gulf Integrators FZE')
  if (!harmony || !gulf) return
  await payload.update({
    collection: 'companies',
    id: harmony.id,
    data: { creditLimit: 50_000_000 },
    ...as(),
  })
  await payload.update({
    collection: 'companies',
    id: gulf.id,
    data: { settings: { stockVisibility: 'banded', orderMultiple: 2, minOrderValue: 1_000_000 } },
    ...as(),
  })
  // An approved demo project (docs/tasks/0017): Lumina II at a project price for Harmony.
  const lumina = (
    await payload.find({
      collection: 'products',
      where: { sku: { equals: 'SONUSFABER-LUMINA-II' } },
      ...as(),
    })
  ).docs[0]
  const owner = (
    await payload.find({
      collection: 'company-users',
      where: { email: { equals: TRADE_USERS.harmonyOwner } },
      ...as(),
    })
  ).docs[0]
  if (lumina && owner) {
    const projects = createProjects(payload)
    const registered = await projects.register({
      company: { id: harmony.id, market: 'ae' },
      registrant: { id: owner.id, role: 'owner' },
      idempotencyKey: 'demo-palm-villa',
      name: 'Palm villa cinema',
      endCustomer: 'Private client',
      expectedClose: new Date(Date.now() + 60 * 24 * 3600_000).toISOString().slice(0, 10),
      lines: [{ sku: lumina.sku, productId: lumina.id, title: 'Lumina II', qty: 12 }],
      details: { city: 'Dubai', note: 'Demo registration (seed:trade).' },
    })
    if (registered.ok && registered.project.status === 'submitted')
      await projects.decide(registered.project.number, {
        by: user.id,
        decision: 'approve',
        // AED 4,500.00 net, below the dealer list (5,266.67).
        prices: { [lumina.sku]: 450_000n },
        validityDays: 365,
        note: 'Approved for the demo.',
      })
  }
  const buyer = await payload.find({
    collection: 'company-users',
    where: { email: { equals: TRADE_USERS.harmonyBuyer } },
    ...as(),
  })
  if (!buyer.docs.length)
    await payload.create({
      collection: 'company-users',
      data: {
        email: TRADE_USERS.harmonyBuyer,
        password: TRADE_PASSWORD,
        company: harmony.id,
        role: 'purchaser',
        // AED 1,000.00 net: most orders need the owner's approval.
        approvalThreshold: 100_000,
        locale: 'en',
        name: 'Sami Khoury',
      },
      ...as(),
    })
}

if (existing.docs.length) {
  await orderSetup()
  payload.logger.info(
    'Trade demo already seeded (Harmony Systems LLC exists); order settings updated.',
  )
  process.exit(0)
}

const brand = async (slug: string) => {
  const doc = (
    await payload.find({ collection: 'brands', where: { slug: { equals: slug } }, ...as() })
  ).docs[0]
  if (!doc) {
    console.error(
      `seed:trade needs the demo catalogue first (seed:catalog); brand ${slug} is missing.`,
    )
    process.exit(1)
  }
  return doc.id
}
const mcintosh = await brand('mcintosh')
const bluesound = await brand('bluesound')

// One product whose landed cost puts the dealer list below the margin floor (needs approval).
const ma252 = (
  await payload.find({
    collection: 'products',
    where: { sku: { equals: 'MCINTOSH-MA252' } },
    ...as(),
  })
).docs[0]
if (ma252)
  await payload.update({
    collection: 'products',
    id: ma252.id,
    data: { cost: 1_400_000, _status: 'published' },
    ...as(),
  })

const list = await payload.create({
  collection: 'price-lists',
  data: {
    name: 'Integrators UAE 2026',
    market: 'ae',
    items: [{ sku: 'MARANTZ-MODEL-40N', price: 880_000 }],
    _status: 'published',
  },
  ...as(),
})
const group = await payload.create({
  collection: 'buyer-groups',
  data: {
    name: 'Integrators',
    priceList: list.id,
    discounts: [{ brand: mcintosh, bps: 500 }],
  },
  ...as(),
})
await payload.create({
  collection: 'price-rules',
  data: {
    name: 'Bluesound autumn',
    kind: 'promotion',
    brand: bluesound,
    minQty: 1,
    bps: 1_000,
    stackable: false,
    markets: ['ae'],
  },
  ...as(),
})

const harmony = await payload.create({
  collection: 'companies',
  data: {
    name: 'Harmony Systems LLC',
    market: 'ae',
    channel: 'dealer',
    tier: 'gold',
    creditLimit: 5_000_000,
    termsDays: 30,
    settings: { stockVisibility: 'exact' },
  },
  ...as(),
})
const gulf = await payload.create({
  collection: 'companies',
  data: {
    name: 'Gulf Integrators FZE',
    market: 'ae',
    channel: 'integrator',
    tier: 'silver',
    buyerGroup: group.id,
    creditLimit: 2_000_000,
    settings: { stockVisibility: 'banded' },
  },
  ...as(),
})
await payload.create({
  collection: 'contract-prices',
  data: { company: harmony.id, sku: 'MCINTOSH-MA352', price: 2_100_000 },
  ...as(),
})

const people: Array<[string, number, 'owner' | 'purchaser' | 'viewer', 'en' | 'ar', string]> = [
  [TRADE_USERS.harmonyOwner, harmony.id, 'owner', 'en', 'Rania Haddad'],
  [TRADE_USERS.harmonyArabic, harmony.id, 'purchaser', 'ar', 'Omar Saleh'],
  [TRADE_USERS.harmonyViewer, harmony.id, 'viewer', 'en', 'Priya Nair'],
  [TRADE_USERS.gulfOwner, gulf.id, 'owner', 'en', 'Daniel Brooks'],
]
for (const [email, company, role, locale, name] of people) {
  await payload.create({
    collection: 'company-users',
    data: { email, password: TRADE_PASSWORD, company, role, locale, name },
    ...as(),
  })
}
await orderSetup()
payload.logger.info(
  `Trade demo ready: sign in on the partners app as ${Object.values(TRADE_USERS).join(', ')}.`,
)
process.exit(0)
