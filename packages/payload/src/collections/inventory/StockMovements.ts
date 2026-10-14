import type { CollectionConfig } from 'payload'
import { isStaff, nobody } from '../../access'
import { refuseLedgerDeletes, refuseLedgerWrites } from '../../hooks/refuseLedgerWrites'
import { DOC_TYPE_OPTIONS, STATE_OPTIONS } from './options'

/**
 * The ledger itself: one row per change of state, insert-only. Written by LedgerService in
 * its own transaction; access, hooks and a database trigger refuse every update and delete.
 */
export const StockMovements: CollectionConfig = {
  slug: 'stock-movements',
  labels: { singular: 'Stock movement', plural: 'Stock movements' },
  admin: {
    group: 'Inventory',
    useAsTitle: 'sku',
    defaultColumns: [
      'createdAt',
      'sku',
      'serial',
      'qty',
      'fromState',
      'toState',
      'location',
      'docType',
      'docId',
    ],
    description: 'Insert-only. Written by the stock ledger; nobody edits or deletes a movement.',
  },
  access: { read: isStaff, create: nobody, update: nobody, delete: nobody },
  hooks: { beforeChange: [refuseLedgerWrites], beforeDelete: [refuseLedgerDeletes] },
  indexes: [{ fields: ['sku', 'location'] }],
  fields: [
    { name: 'sku', type: 'text', required: true, index: true },
    { name: 'serial', type: 'text', index: true },
    { name: 'qty', type: 'number', required: true, min: 1 },
    {
      name: 'fromState',
      type: 'select',
      options: STATE_OPTIONS,
      admin: { description: 'Empty: the stock entered the ledger.' },
    },
    {
      name: 'toState',
      type: 'select',
      options: STATE_OPTIONS,
      admin: { description: 'Empty: the stock left the ledger.' },
    },
    { name: 'location', type: 'relationship', relationTo: 'locations', required: true },
    { name: 'docType', type: 'select', required: true, options: DOC_TYPE_OPTIONS },
    { name: 'docId', type: 'text', required: true },
    { name: 'user', type: 'relationship', relationTo: 'users' },
    { name: 'reason', type: 'textarea' },
  ],
}
