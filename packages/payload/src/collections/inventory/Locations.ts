import type { CollectionConfig } from 'payload'
import { isStaff, nobody } from '../../access'

/** A place inside a warehouse (zone, bin, showroom floor). Every stock quantity has one. */
export const Locations: CollectionConfig = {
  slug: 'locations',
  labels: { singular: 'Location', plural: 'Locations' },
  admin: {
    group: 'Inventory',
    useAsTitle: 'code',
    defaultColumns: ['code', 'warehouse', 'sellable', 'priority', 'active'],
  },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: nobody },
  indexes: [{ fields: ['warehouse', 'code'], unique: true }],
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'code',
          type: 'text',
          required: true,
          admin: { width: '30%', description: 'e.g. DXB-WH1-A01.' },
        },
        {
          name: 'warehouse',
          type: 'relationship',
          relationTo: 'warehouses',
          required: true,
          admin: { width: '40%' },
        },
        { name: 'name', type: 'text', admin: { width: '30%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'sellable',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            width: '40%',
            description:
              "Part of the market's fulfilment set: its available stock is sellable online.",
          },
        },
        {
          name: 'priority',
          type: 'number',
          defaultValue: 100,
          min: 0,
          admin: { width: '30%', description: 'Reservations try lower numbers first.' },
        },
        { name: 'active', type: 'checkbox', defaultValue: true, admin: { width: '30%' } },
      ],
    },
  ],
}
