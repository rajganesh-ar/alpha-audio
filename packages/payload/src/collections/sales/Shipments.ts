import type { CollectionConfig } from 'payload'
import { isStaff, nobody, systemWritten } from '../../access'
import { MARKET_CODES } from '../../markets/codes'

const system = { create: systemWritten, update: systemWritten }

/**
 * One parcel handed to a courier for an order (docs/tasks/0010). Courier integration is an open
 * decision, so staff record the courier and tracking number on the ops screens; the stock moves
 * `picked → shipped` against this document. Staff read; only the fulfilment service writes.
 */
export const Shipments: CollectionConfig = {
  slug: 'shipments',
  labels: { singular: 'Shipment', plural: 'Shipments' },
  admin: {
    group: 'Sales',
    useAsTitle: 'number',
    defaultColumns: ['number', 'order', 'courier', 'trackingNumber', 'status', 'shippedAt'],
  },
  access: { read: isStaff, create: nobody, update: nobody, delete: nobody },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'number',
          type: 'text',
          required: true,
          unique: true,
          access: system,
          admin: { width: '25%' },
        },
        // One shipment per order until split shipments exist: a retried ship finds this one.
        {
          name: 'order',
          type: 'relationship',
          relationTo: 'orders',
          required: true,
          unique: true,
          access: system,
          admin: { width: '25%' },
        },
        {
          name: 'market',
          type: 'select',
          required: true,
          options: MARKET_CODES.map((c) => ({ label: c.toUpperCase(), value: c })),
          access: system,
          admin: { width: '25%' },
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'shipped',
          options: ['shipped', 'delivered'].map((s) => ({ label: s, value: s })),
          access: system,
          admin: { width: '25%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'courier', type: 'text', required: true, access: system, admin: { width: '33%' } },
        {
          name: 'trackingNumber',
          type: 'text',
          required: true,
          index: true,
          access: system,
          admin: { width: '33%' },
        },
        { name: 'trackingUrl', type: 'text', access: system, admin: { width: '33%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'shippedAt',
          type: 'date',
          required: true,
          access: system,
          admin: { width: '50%', date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'deliveredAt',
          type: 'date',
          access: system,
          admin: { width: '50%', date: { pickerAppearance: 'dayAndTime' } },
        },
      ],
    },
  ],
}
