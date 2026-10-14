/**
 * Local development only: a supplier, an open purchase order to the Dubai warehouse and one
 * posted, put-away goods receipt against it, all through the receiving service.
 *
 *   pnpm --filter @alpha/web seed:inventory   # first: the warehouse
 *   pnpm --filter @alpha/web seed:purchasing
 *
 * Refuses to run in production. Safe to re-run: it stops if the purchase order already exists.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { createReceiving, ensureStaffUser } from '@alpha/payload'

if (process.env.NODE_ENV === 'production') {
  console.error('seed:purchasing is for local development and refuses to run in production.')
  process.exit(1)
}

const payload = await getPayload({ config })
const user = await ensureStaffUser(payload, {
  email: 'dev@alpha.local',
  password: 'dev-password-123',
})
const as = { user, overrideAccess: false } as const

const existing = await payload.find({
  collection: 'purchase-orders',
  where: { number: { equals: 'PO-2026-0100' } },
  ...as,
})
if (existing.docs.length) {
  payload.logger.info('Demo purchasing already seeded (PO-2026-0100 exists); nothing to do.')
  process.exit(0)
}
const warehouses = await payload.find({
  collection: 'warehouses',
  where: { code: { equals: 'DXB-WH1' } },
  ...as,
})
const warehouse = warehouses.docs[0]
if (!warehouse) {
  payload.logger.error('Run seed:inventory first: DXB-WH1 is missing.')
  process.exit(1)
}
const shelves = await payload.find({
  collection: 'locations',
  where: { code: { equals: 'DXB-WH1-A01' } },
  ...as,
})
const shelf = shelves.docs[0]
if (!shelf) {
  payload.logger.error('Run seed:inventory first: DXB-WH1-A01 is missing.')
  process.exit(1)
}

const dock = await payload.create({
  collection: 'locations',
  data: {
    code: 'DXB-WH1-DOCK',
    name: 'Receiving dock',
    warehouse: warehouse.id,
    sellable: false,
    priority: 90,
  },
  ...as,
})
const supplier = await payload.create({
  collection: 'suppliers',
  data: {
    code: 'MCINTOSH-US',
    name: 'McIntosh Laboratory',
    country: 'US',
    currency: 'USD',
    leadTimeDays: 45,
    contact: { name: 'Export desk', email: 'export@example.com' },
  },
  ...as,
})
const po = await payload.create({
  collection: 'purchase-orders',
  data: {
    number: 'PO-2026-0100',
    supplier: supplier.id,
    warehouse: warehouse.id,
    currency: 'USD',
    decimals: 2,
    expectedAt: '2026-11-02T00:00:00.000Z',
    status: 'ordered',
    lines: [
      {
        sku: 'MCINTOSH-MA352',
        description: 'MA352 integrated amplifier',
        qtyOrdered: 4,
        unitCost: 450000,
      },
      {
        sku: 'MCINTOSH-MC462',
        description: 'MC462 power amplifier',
        qtyOrdered: 3,
        unitCost: 610000,
        serialised: true,
      },
    ],
  },
  ...as,
})
const [ma352, mc462] = po.lines ?? []
if (!ma352?.id || !mc462?.id) throw new Error('Purchase order lines were not saved.')

const receipt = await payload.create({
  collection: 'goods-receipts',
  data: {
    number: 'GR-2026-0002',
    purchaseOrder: po.id,
    location: dock.id,
    status: 'draft', // the type requires it; staff cannot set it and draft is the default
    lines: [
      {
        poLine: ma352.id,
        sku: 'MCINTOSH-MA352',
        qty: 2,
        exceptions: [{ type: 'damaged', qty: 1, note: 'Carton crushed at one corner' }],
      },
      { poLine: mc462.id, sku: 'MCINTOSH-MC462', qty: 2, serials: ['MC462-0101', 'MC462-0102'] },
    ],
  },
  ...as,
})

const receiving = createReceiving(payload)
const posted = await receiving.postReceipt(receipt.id, { user: user.id })
const { available } = await receiving.putaway(receipt.id, { location: shelf.id, user: user.id })
const eta = await receiving.openPurchaseEta('MCINTOSH-MA352', 'ae')

payload.logger.info(
  `Demo purchasing seeded: ${po.number} is ${posted.poStatus}; ${receipt.number} booked ${posted.booked} (${posted.quarantined} to quarantine), ${available} put away; next MA352 ETA ${eta?.toISOString().slice(0, 10) ?? 'none'}.`,
)
process.exit(0)
