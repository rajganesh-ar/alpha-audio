import type { CollectionConfig } from 'payload'
import { isStaff, nobody } from '../../access'
import { MARKET_CODES } from '../../markets/codes'
import { LOCATION_TYPE_OPTIONS } from './options'

/** A site that holds stock: a warehouse, a showroom, a consignment partner. */
export const Warehouses: CollectionConfig = {
  slug: 'warehouses',
  labels: { singular: 'Warehouse', plural: 'Warehouses' },
  admin: {
    group: 'Inventory',
    useAsTitle: 'code',
    defaultColumns: ['code', 'name', 'market', 'type', 'active'],
  },
  // Sites are archived (`active: false`), never deleted: movements point at their locations.
  access: { read: isStaff, create: isStaff, update: isStaff, delete: nobody },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'code',
          type: 'text',
          required: true,
          unique: true,
          index: true,
          admin: { width: '25%', description: 'Short code, e.g. DXB-WH1.' },
        },
        { name: 'name', type: 'text', required: true, localized: true, admin: { width: '45%' } },
        {
          name: 'market',
          type: 'select',
          required: true,
          options: MARKET_CODES.map((m) => ({ label: m, value: m })),
          admin: { width: '15%' },
        },
        {
          name: 'type',
          type: 'select',
          required: true,
          defaultValue: 'warehouse',
          options: LOCATION_TYPE_OPTIONS,
          admin: { width: '15%' },
        },
      ],
    },
    {
      name: 'address',
      type: 'group',
      fields: [
        { name: 'line1', type: 'text' },
        { name: 'city', type: 'text' },
      ],
    },
    { name: 'active', type: 'checkbox', defaultValue: true },
  ],
}
