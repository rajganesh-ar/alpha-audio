import type { CollectionConfig } from 'payload'
import { isStaff, nobody } from '../../access'
import { refuseLedgerDeletes, refuseLedgerWrites } from '../../hooks/refuseLedgerWrites'
import { STATE_OPTIONS } from './options'

/**
 * Current quantity per (sku, location, state), derived from StockMovements and kept in step by
 * the ledger in the same transaction. Read-only everywhere; dealers will see it banded.
 */
export const StockLevels: CollectionConfig = {
  slug: 'stock-levels',
  labels: { singular: 'Stock level', plural: 'Stock levels' },
  admin: {
    group: 'Inventory',
    useAsTitle: 'sku',
    defaultColumns: ['sku', 'location', 'state', 'qty', 'updatedAt'],
    description:
      'Derived from stock movements. Read-only: quantities change only through the ledger.',
  },
  access: { read: isStaff, create: nobody, update: nobody, delete: nobody },
  hooks: { beforeChange: [refuseLedgerWrites], beforeDelete: [refuseLedgerDeletes] },
  indexes: [{ fields: ['sku', 'location', 'state'], unique: true }],
  fields: [
    { name: 'sku', type: 'text', required: true, index: true },
    { name: 'location', type: 'relationship', relationTo: 'locations', required: true },
    { name: 'state', type: 'select', required: true, options: STATE_OPTIONS },
    { name: 'qty', type: 'number', required: true, min: 0, defaultValue: 0 },
  ],
}
