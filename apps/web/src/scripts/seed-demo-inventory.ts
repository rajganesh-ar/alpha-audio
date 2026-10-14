/**
 * Local development only: a Dubai warehouse with three locations and some stock, all written
 * through the ledger, so the admin's inventory screens and the Ledger explorer have data.
 *
 *   pnpm --filter @alpha/web seed:inventory
 *
 * Refuses to run in production. Safe to re-run: it stops if the warehouse already exists.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { createLedger, ensureStaffUser } from '@alpha/payload'

if (process.env.NODE_ENV === 'production') {
  console.error('seed:inventory is for local development and refuses to run in production.')
  process.exit(1)
}

const payload = await getPayload({ config })
const user = await ensureStaffUser(payload, {
  email: 'dev@alpha.local',
  password: 'dev-password-123',
})
const existing = await payload.find({
  collection: 'warehouses',
  where: { code: { equals: 'DXB-WH1' } },
  user,
  overrideAccess: false,
})
if (existing.docs.length) {
  payload.logger.info('Demo inventory already seeded (DXB-WH1 exists); nothing to do.')
  process.exit(0)
}

const warehouse = await payload.create({
  collection: 'warehouses',
  data: {
    code: 'DXB-WH1',
    name: 'Dubai warehouse',
    market: 'ae',
    type: 'warehouse',
    address: { line1: 'Al Quoz Industrial 3', city: 'Dubai' },
  },
  user,
  overrideAccess: false,
})
const location = (code: string, name: string, sellable: boolean, priority: number) =>
  payload.create({
    collection: 'locations',
    data: { code, name, warehouse: warehouse.id, sellable, priority },
    user,
    overrideAccess: false,
  })
const main = await location('DXB-WH1-A01', 'Main stock, aisle A', true, 10)
const showroom = await location('DXB-SHOW', 'Dubai showroom floor', true, 20)
const demo = await location('DXB-DEMO', 'Listening room', false, 30)

const ledger = createLedger(payload)
const receipt = { type: 'receipt', id: 'GR-2026-0001' } as const
await ledger.move({
  sku: 'MCINTOSH-MA352',
  qty: 6,
  from: null,
  to: 'received',
  location: main.id,
  doc: receipt,
  user: user.id,
})
await ledger.move({
  sku: 'MCINTOSH-MA352',
  qty: 6,
  from: 'received',
  to: 'available',
  location: main.id,
  doc: receipt,
  user: user.id,
})
await ledger.transfer({
  sku: 'MCINTOSH-MA352',
  qty: 1,
  from: { location: main.id, state: 'available' },
  to: { location: showroom.id, state: 'ex_display' },
  doc: { type: 'transfer', id: 'TR-0001' },
  user: user.id,
})
await ledger.reserve({
  sku: 'MCINTOSH-MA352',
  qty: 2,
  market: 'ae',
  doc: { type: 'quote', id: 'Q-2026-0042' },
  user: user.id,
})

for (const n of ['0001', '0002', '0003']) {
  await ledger.move({
    sku: 'MCINTOSH-MC462',
    qty: 1,
    serial: `MC462-${n}`,
    from: null,
    to: 'available',
    location: main.id,
    doc: receipt,
    user: user.id,
  })
}
await ledger.transfer({
  sku: 'MCINTOSH-MC462',
  qty: 1,
  serial: 'MC462-0001',
  from: { location: main.id, state: 'available' },
  to: { location: demo.id, state: 'demo' },
  doc: { type: 'transfer', id: 'TR-0002' },
  user: user.id,
})
await ledger.transfer({
  sku: 'MCINTOSH-MC462',
  qty: 1,
  serial: 'MC462-0001',
  from: { location: demo.id, state: 'demo' },
  to: { location: main.id, state: 'available' },
  doc: { type: 'transfer', id: 'TR-0003' },
  user: user.id,
})
const order = await ledger.reserve({
  sku: 'MCINTOSH-MC462',
  qty: 1,
  location: main.id,
  doc: { type: 'order', id: 'AE-1001' },
  user: user.id,
})
if (order.ok) {
  await ledger.pick(order.reservation.id, { user: user.id })
  await ledger.ship({
    sku: 'MCINTOSH-MC462',
    qty: 1,
    serial: order.reservation.serials[0],
    location: main.id,
    doc: { type: 'shipment', id: 'SH-0001' },
    user: user.id,
  })
}
await ledger.adjustFromCount({
  sku: 'MCINTOSH-MA352',
  location: main.id,
  counted: 2,
  reason: 'Cycle count: one unit missing, investigation opened',
  countId: 'SC-0001',
  user: user.id,
})

payload.logger.info(
  `Demo inventory seeded: ${warehouse.code} with 3 locations; sellable MA352 in ae = ${await ledger.sellable('MCINTOSH-MA352', 'ae')}.`,
)
process.exit(0)
