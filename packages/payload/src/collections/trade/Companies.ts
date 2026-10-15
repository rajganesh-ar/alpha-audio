import type { CollectionConfig } from 'payload'
import { CHANNELS, STOCK_VISIBILITIES } from '@alpha/core'
import { canReadCompanyTerms, isStaff, nobody, staffField, staffOrOwnCompany } from '../../access'
import { MARKET_CODES } from '../../markets/codes'
import { wholeNumber } from '../purchasing/fields'

const terms = { read: canReadCompanyTerms }

/**
 * Trade customers: dealers, integrators and retailers (docs/tasks/0013). Commercial staff
 * maintain them; a company's users read only their own company, and only its owner and
 * purchasers read credit, terms and order settings. Never deleted.
 */
export const Companies: CollectionConfig = {
  slug: 'companies',
  labels: { singular: 'Company', plural: 'Companies' },
  admin: {
    group: 'Trade',
    useAsTitle: 'name',
    defaultColumns: ['name', 'market', 'channel', 'tier', 'hold'],
  },
  access: { read: staffOrOwnCompany, create: isStaff, update: isStaff, delete: nobody },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        {
          name: 'market',
          type: 'select',
          required: true,
          options: MARKET_CODES.map((c) => ({ label: c.toUpperCase(), value: c })),
          admin: { width: '25%' },
        },
        {
          name: 'channel',
          type: 'select',
          required: true,
          defaultValue: 'dealer',
          options: CHANNELS.map((c) => ({ label: c, value: c })),
          admin: { width: '25%' },
        },
        {
          name: 'tier',
          type: 'select',
          defaultValue: 'standard',
          options: ['gold', 'silver', 'standard'].map((t) => ({ label: t, value: t })),
          admin: { width: '25%' },
        },
        {
          name: 'hold',
          type: 'checkbox',
          defaultValue: false,
          access: terms,
          admin: { width: '25%', description: 'Blocks ordering (overdue invoices), not quoting.' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'buyerGroup',
          type: 'relationship',
          relationTo: 'buyer-groups',
          access: { read: staffField },
          admin: { width: '50%' },
        },
        {
          name: 'priceList',
          type: 'relationship',
          relationTo: 'price-lists',
          access: { read: staffField },
          admin: { width: '50%', description: 'Overrides the buyer group’s list.' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'creditLimit',
          type: 'number',
          access: terms,
          validate: wholeNumber('Credit limit', 0),
          admin: { width: '50%', description: 'Minor units of the market currency.' },
        },
        {
          name: 'termsDays',
          label: 'Payment terms (days)',
          type: 'number',
          defaultValue: 30,
          access: terms,
          validate: wholeNumber('Payment terms', 0),
          admin: { width: '50%' },
        },
      ],
    },
    {
      name: 'settings',
      type: 'group',
      access: terms,
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'stockVisibility',
              type: 'select',
              required: true,
              defaultValue: 'banded',
              options: STOCK_VISIBILITIES.map((v) => ({ label: v, value: v })),
              admin: { width: '33%' },
            },
            {
              name: 'minOrderValue',
              type: 'number',
              validate: wholeNumber('Minimum order value', 0),
              admin: { width: '33%' },
            },
            {
              name: 'orderMultiple',
              type: 'number',
              defaultValue: 1,
              validate: wholeNumber('Order multiple', 1),
              admin: { width: '33%' },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'freeFreightThreshold',
              type: 'number',
              validate: wholeNumber('Free-freight threshold', 0),
              admin: { width: '50%' },
            },
            {
              name: 'dropShipAllowed',
              type: 'checkbox',
              defaultValue: false,
              admin: { width: '50%' },
            },
          ],
        },
      ],
    },
  ],
}
