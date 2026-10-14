import type { CollectionConfig } from 'payload'
import { isStaff, nobody } from '../../access'
import { currencyField, wholeNumber } from './fields'

/** Brands' distributors and manufacturers Alpha buys from. Archived, never deleted. */
export const Suppliers: CollectionConfig = {
  slug: 'suppliers',
  labels: { singular: 'Supplier', plural: 'Suppliers' },
  admin: {
    group: 'Purchasing',
    useAsTitle: 'name',
    defaultColumns: ['code', 'name', 'country', 'currency', 'leadTimeDays', 'active'],
  },
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
          admin: { width: '20%' },
        },
        { name: 'name', type: 'text', required: true, admin: { width: '40%' } },
        {
          name: 'country',
          type: 'text',
          required: true,
          admin: { width: '20%', description: 'ISO 3166-1 alpha-2, e.g. US.' },
          validate: (value: unknown) =>
            typeof value === 'string' && /^[A-Z]{2}$/.test(value)
              ? true
              : 'Use a two-letter country code, e.g. US.',
        },
        currencyField(),
      ],
    },
    {
      name: 'leadTimeDays',
      type: 'number',
      defaultValue: 30,
      validate: wholeNumber('Lead time', 0),
    },
    {
      name: 'contact',
      type: 'group',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'email', type: 'email' },
        { name: 'phone', type: 'text' },
      ],
    },
    { name: 'active', type: 'checkbox', defaultValue: true },
  ],
}
