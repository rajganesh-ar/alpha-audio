import type { Payload } from 'payload'
import type { GoodsReceipt, PurchaseOrder } from '../../../src/payload-types'
import { seedInventory, staff, type InventoryFixture } from './ledger'

export interface PurchasingFixture extends InventoryFixture {
  supplier: number
  /** Non-sellable receiving dock in the same warehouse. */
  dock: number
  po: PurchaseOrder
  /** PO line ids: bulk MA352 × 10, serialised MC462 × 3. */
  bulk: string
  serialised: string
}

let sequence = 0

type LineInput = NonNullable<PurchaseOrder['lines']>[number]

/** A warehouse, a supplier and an ordered PO to it, created as staff through the Local API. */
export async function seedPurchasing(
  payload: Payload,
  options: {
    status?: PurchaseOrder['status']
    expectedAt?: string | null
    lines?: LineInput[]
    market?: string
  } = {},
): Promise<PurchasingFixture> {
  const user = await staff(payload)
  const as = { user, overrideAccess: false } as const
  const inventory = await seedInventory(payload)
  const n = ++sequence
  const dock = await payload.create({
    collection: 'locations',
    data: { code: `DOCK-${n}`, warehouse: inventory.warehouse, sellable: false, priority: 90 },
    ...as,
  })
  const supplier = await payload.create({
    collection: 'suppliers',
    data: { code: `SUP-${n}`, name: `Supplier ${n}`, country: 'US', currency: 'USD' },
    ...as,
  })
  const po = await payload.create({
    collection: 'purchase-orders',
    data: {
      number: `PO-T-${n}-${Date.now()}`,
      supplier: supplier.id,
      warehouse: inventory.warehouse,
      currency: 'USD',
      decimals: 2,
      expectedAt:
        options.expectedAt === undefined ? '2026-11-02T00:00:00.000Z' : options.expectedAt,
      status: options.status ?? 'ordered',
      lines: options.lines ?? [
        { sku: 'MA352', description: 'Integrated amplifier', qtyOrdered: 10, unitCost: 450000 },
        {
          sku: 'MC462',
          description: 'Power amplifier',
          qtyOrdered: 3,
          unitCost: 610000,
          serialised: true,
        },
      ],
    },
    ...as,
  })
  const [bulk, serialised] = (po.lines ?? []).map((l) => l.id ?? '')
  return {
    ...inventory,
    supplier: supplier.id,
    dock: dock.id,
    po,
    bulk: bulk ?? '',
    serialised: serialised ?? '',
  }
}

let receipts = 0

/** A draft goods receipt at the fixture's dock. */
export async function draftReceipt(
  payload: Payload,
  fixture: Pick<PurchasingFixture, 'po' | 'dock'>,
  lines: NonNullable<GoodsReceipt['lines']>,
  location = fixture.dock,
): Promise<GoodsReceipt> {
  const user = await staff(payload)
  return payload.create({
    collection: 'goods-receipts',
    data: {
      number: `GR-T-${++receipts}-${Date.now()}`,
      purchaseOrder: fixture.po.id,
      location,
      status: 'draft',
      lines,
    },
    user,
    overrideAccess: false,
  })
}
