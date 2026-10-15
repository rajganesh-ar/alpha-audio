import type { CollectionConfig } from 'payload'
import { noOneReads, nobody, systemWritten } from '../../access'
import { LOCALE_CODES, MARKET_CODES } from '../../markets/codes'

const system = { create: systemWritten, update: systemWritten }

/**
 * Shopping bags (docs/tasks/0009). The browser holds a random token in an httpOnly cookie; only
 * its SHA-256 lives here. System only (task 0009): the draft holds an anonymous shopper's
 * contact and address, so not even staff read carts through Payload; the bag service does.
 * Expired carts are purged by `purgeExpiredData` (later task).
 */
export const Carts: CollectionConfig = {
  slug: 'carts',
  labels: { singular: 'Cart', plural: 'Carts' },
  admin: { group: 'Sales', defaultColumns: ['market', 'status', 'updatedAt', 'expiresAt'] },
  access: { read: nobody, create: nobody, update: nobody, delete: nobody },
  fields: [
    {
      name: 'tokenHash',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      access: { ...system, read: noOneReads },
      admin: { hidden: true },
    },
    {
      name: 'market',
      type: 'select',
      required: true,
      options: MARKET_CODES.map((c) => ({ label: c.toUpperCase(), value: c })),
      access: system,
    },
    {
      name: 'locale',
      type: 'select',
      required: true,
      options: LOCALE_CODES.map((c) => ({ label: c, value: c })),
      access: system,
    },
    {
      name: 'lines',
      type: 'array',
      access: system,
      fields: [
        { name: 'sku', type: 'text', required: true },
        { name: 'qty', type: 'number', required: true },
        {
          name: 'priceSnapshot',
          type: 'number',
          admin: {
            description: 'Unit price incl. VAT when added (minor units), to announce a change.',
          },
        },
      ],
    },
    {
      name: 'draft',
      type: 'json',
      access: system,
      admin: { description: 'Checkout details entered so far.' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'open',
      options: ['open', 'converted'].map((s) => ({ label: s, value: s })),
      access: system,
    },
    { name: 'order', type: 'relationship', relationTo: 'orders', access: system },
    { name: 'expiresAt', type: 'date', required: true, index: true, access: system },
  ],
}
