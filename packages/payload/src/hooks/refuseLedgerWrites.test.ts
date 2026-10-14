import { describe, expect, it } from 'vitest'
import { inventoryCollections } from '../collections/inventory'
import { refuseLedgerDeletes, refuseLedgerWrites } from './refuseLedgerWrites'

/**
 * Payload runs collection hooks whether or not access is overridden, so these hooks are what
 * stops an `overrideAccess: true` script from editing the ledger (access stops everyone else,
 * and a database trigger stops raw SQL).
 */
const LEDGER_OWNED = ['stock-movements', 'stock-levels', 'serial-numbers', 'reservations']

describe('ledger write refusal', () => {
  it.each(['create', 'update'] as const)('refuses %s with a 403', (operation) => {
    const call = () =>
      refuseLedgerWrites({ collection: { slug: 'stock-movements' }, operation } as never)
    expect(call).toThrow(/stock-movements is written only by the stock ledger/)
    try {
      call()
    } catch (error) {
      expect((error as { status?: number }).status).toBe(403)
    }
  })

  it('refuses deletes with a 403', () => {
    expect(() => refuseLedgerDeletes({ collection: { slug: 'stock-levels' } } as never)).toThrow(
      /never deleted/,
    )
  })

  it.each(LEDGER_OWNED)('%s carries both hooks and refuses writes in access', (slug) => {
    const collection = inventoryCollections.find((c) => c.slug === slug)
    expect(collection?.hooks?.beforeChange).toContain(refuseLedgerWrites)
    expect(collection?.hooks?.beforeDelete).toContain(refuseLedgerDeletes)
    for (const op of ['create', 'update', 'delete'] as const) {
      const access = collection?.access?.[op] as (() => boolean) | undefined
      expect(access?.(), `${slug} ${op}`).toBe(false)
    }
  })

  it('lets staff manage warehouses and locations but never delete them', () => {
    for (const slug of ['warehouses', 'locations']) {
      const collection = inventoryCollections.find((c) => c.slug === slug)
      expect((collection?.access?.delete as () => boolean)()).toBe(false)
      expect(collection?.hooks?.beforeChange ?? []).toHaveLength(0)
    }
  })
})
