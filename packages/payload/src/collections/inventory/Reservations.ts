import type { CollectionConfig } from 'payload'
import { isStaff, nobody } from '../../access'
import { refuseLedgerDeletes, refuseLedgerWrites } from '../../hooks/refuseLedgerWrites'
import { RESERVATION_DOC_TYPE_OPTIONS, RESERVATION_STATUS_OPTIONS } from './options'

/** Stock held for a document (cart, quote, POS sale, project, order). Kept by the ledger. */
export const Reservations: CollectionConfig = {
  slug: 'reservations',
  labels: { singular: 'Reservation', plural: 'Reservations' },
  admin: {
    group: 'Inventory',
    useAsTitle: 'docId',
    defaultColumns: ['docType', 'docId', 'sku', 'qty', 'location', 'status', 'expiresAt'],
  },
  access: { read: isStaff, create: nobody, update: nobody, delete: nobody },
  hooks: { beforeChange: [refuseLedgerWrites], beforeDelete: [refuseLedgerDeletes] },
  indexes: [{ fields: ['status', 'expiresAt'] }, { fields: ['docType', 'docId'] }],
  fields: [
    { name: 'sku', type: 'text', required: true, index: true },
    { name: 'location', type: 'relationship', relationTo: 'locations', required: true },
    { name: 'qty', type: 'number', required: true, min: 1 },
    {
      name: 'serials',
      type: 'json',
      admin: { description: 'Serial numbers held, for serialised SKUs.' },
    },
    { name: 'docType', type: 'select', required: true, options: RESERVATION_DOC_TYPE_OPTIONS },
    { name: 'docId', type: 'text', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: RESERVATION_STATUS_OPTIONS,
    },
    {
      name: 'expiresAt',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Empty: held until picked or released (paid orders).',
      },
    },
  ],
}
