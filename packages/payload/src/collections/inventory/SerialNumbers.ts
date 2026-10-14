import type { CollectionConfig } from 'payload'
import { isStaff, nobody } from '../../access'
import { refuseLedgerDeletes, refuseLedgerWrites } from '../../hooks/refuseLedgerWrites'
import { STATE_OPTIONS } from './options'

/**
 * One row per serialised unit with its current state and location, kept by the ledger. The
 * unit's history is its movements (see the Ledger explorer). Owner and warranty arrive with
 * the customer and RMA tasks.
 */
export const SerialNumbers: CollectionConfig = {
  slug: 'serial-numbers',
  labels: { singular: 'Serial number', plural: 'Serial numbers' },
  admin: {
    group: 'Inventory',
    useAsTitle: 'serial',
    defaultColumns: ['serial', 'sku', 'currentState', 'location', 'updatedAt'],
  },
  access: { read: isStaff, create: nobody, update: nobody, delete: nobody },
  hooks: { beforeChange: [refuseLedgerWrites], beforeDelete: [refuseLedgerDeletes] },
  fields: [
    { name: 'serial', type: 'text', required: true, unique: true, index: true },
    { name: 'sku', type: 'text', required: true, index: true },
    {
      name: 'currentState',
      type: 'select',
      options: STATE_OPTIONS,
      admin: { description: 'Empty: the unit has left the ledger.' },
    },
    { name: 'location', type: 'relationship', relationTo: 'locations' },
  ],
}
