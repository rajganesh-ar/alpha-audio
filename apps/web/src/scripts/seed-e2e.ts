/**
 * Local development and CI only: tops up the stock the checkout end-to-end tests buy, so the
 * suite can run again and again against one seeded database (each run confirms orders that
 * hold stock for good). Run after the demo seeds:
 *
 *   pnpm --filter @alpha/web seed:e2e
 *
 * Refuses to run in production. Books stock through the ledger like any opening balance.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { createLedger, ensureStaffUser } from '@alpha/payload'

const E2E_SKU = 'SONUSFABER-LUMINA-II'
const TARGET = 20

if (process.env.NODE_ENV === 'production') {
  console.error('seed:e2e is for local development and CI and refuses to run in production.')
  process.exit(1)
}

const payload = await getPayload({ config })
const user = await ensureStaffUser(payload, {
  email: 'dev@alpha.local',
  password: 'dev-password-123',
})
const shelf = (
  await payload.find({
    collection: 'locations',
    where: { code: { equals: 'DXB-WH1-A01' } },
    user,
    overrideAccess: false,
  })
).docs[0]
if (!shelf) {
  console.error('seed:e2e needs the demo seeds first (seed:inventory, seed:catalog).')
  process.exit(1)
}
const ledger = createLedger(payload)
const sellable = await ledger.sellable(E2E_SKU, 'ae')
if (sellable < TARGET) {
  await ledger.move({
    sku: E2E_SKU,
    qty: TARGET - sellable,
    from: null,
    to: 'available',
    location: shelf.id,
    doc: { type: 'opening', id: `E2E-${new Date().toISOString().slice(0, 10)}` },
    user: user.id,
  })
}
payload.logger.info(`E2E stock ready: ${E2E_SKU} sellable in ae = ${Math.max(sellable, TARGET)}.`)
process.exit(0)
