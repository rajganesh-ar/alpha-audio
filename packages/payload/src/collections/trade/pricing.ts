import type { CollectionConfig, Field } from 'payload'
import { isStaff, nobody } from '../../access'
import { MARKET_CODES } from '../../markets/codes'
import { wholeNumber } from '../purchasing/fields'

/**
 * Trade pricing data (docs/tasks/0013): what commercial staff maintain and the price engine
 * reads. Staff only: companies see the outcome (their price, with its trace), never the rules.
 */
const staffOnly = { read: isStaff, create: isStaff, update: isStaff, delete: nobody }

const bps = (name: string, label: string): Field => ({
  name,
  label,
  type: 'number',
  required: true,
  validate: (v: unknown) =>
    typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v < 10_000
      ? true
      : `${label} is basis points from 0 to 9999 (100 = 1%).`,
  admin: { description: 'Basis points: 100 = 1%.' },
})

const validity: Field = {
  type: 'row',
  fields: [
    { name: 'validFrom', type: 'date', admin: { width: '50%' } },
    {
      name: 'validTo',
      type: 'date',
      admin: { width: '50%', description: 'Exclusive; empty means open-ended.' },
    },
  ],
}

const market = (required: boolean): Field => ({
  name: 'market',
  type: 'select',
  required,
  options: MARKET_CODES.map((c) => ({ label: c.toUpperCase(), value: c })),
})

export const BuyerGroups: CollectionConfig = {
  slug: 'buyer-groups',
  labels: { singular: 'Buyer group', plural: 'Buyer groups' },
  admin: { group: 'Trade', useAsTitle: 'name' },
  access: staffOnly,
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'priceList',
      type: 'relationship',
      relationTo: 'price-lists',
      admin: { description: 'Used by members without their own list.' },
    },
    {
      name: 'discounts',
      type: 'array',
      admin: {
        description:
          'Off the dealer list price. A brand row beats a category row, which beats an all-products row.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'brand', type: 'relationship', relationTo: 'brands', admin: { width: '33%' } },
            {
              name: 'category',
              type: 'relationship',
              relationTo: 'categories',
              admin: { width: '33%' },
            },
            { ...bps('bps', 'Discount'), admin: { width: '33%' } } as Field,
          ],
        },
      ],
    },
  ],
}

export const PriceLists: CollectionConfig = {
  slug: 'price-lists',
  labels: { singular: 'Price list', plural: 'Price lists' },
  admin: {
    group: 'Trade',
    useAsTitle: 'name',
    defaultColumns: ['name', 'market', 'validFrom', 'validTo', '_status'],
  },
  versions: { drafts: true },
  access: { ...staffOnly, readVersions: isStaff },
  fields: [
    { name: 'name', type: 'text', required: true },
    market(true),
    validity,
    {
      name: 'items',
      type: 'array',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'sku', type: 'text', required: true, admin: { width: '50%' } },
            {
              name: 'price',
              type: 'number',
              required: true,
              validate: wholeNumber('Price', 0),
              admin: { width: '50%', description: 'Net unit price, minor units.' },
            },
          ],
        },
      ],
    },
  ],
}

export const ContractPrices: CollectionConfig = {
  slug: 'contract-prices',
  labels: { singular: 'Contract price', plural: 'Contract prices' },
  admin: {
    group: 'Trade',
    useAsTitle: 'sku',
    defaultColumns: ['company', 'sku', 'price', 'validTo'],
  },
  access: staffOnly,
  indexes: [{ fields: ['company', 'sku'] }],
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'company',
          type: 'relationship',
          relationTo: 'companies',
          required: true,
          admin: { width: '40%' },
        },
        { name: 'sku', type: 'text', required: true, admin: { width: '30%' } },
        {
          name: 'price',
          type: 'number',
          required: true,
          validate: wholeNumber('Price', 0),
          admin: {
            width: '30%',
            description: 'Net unit price, minor units of the company’s market.',
          },
        },
      ],
    },
    validity,
  ],
}

export const PriceRules: CollectionConfig = {
  slug: 'price-rules',
  labels: { singular: 'Price rule', plural: 'Price rules' },
  admin: { group: 'Trade', useAsTitle: 'name', defaultColumns: ['name', 'kind', 'bps', 'validTo'] },
  access: staffOnly,
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        {
          name: 'kind',
          type: 'select',
          required: true,
          options: [
            { label: 'Volume break', value: 'volume' },
            { label: 'Promotion', value: 'promotion' },
          ],
          admin: { width: '25%' },
        },
        { name: 'sku', type: 'text', admin: { width: '25%', description: 'One SKU, or…' } },
        {
          name: 'brand',
          type: 'relationship',
          relationTo: 'brands',
          admin: { width: '25%', description: '…a brand; neither means every product.' },
        },
        {
          name: 'minQty',
          type: 'number',
          required: true,
          defaultValue: 1,
          validate: wholeNumber('Minimum quantity', 1),
          admin: { width: '25%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { ...bps('bps', 'Discount'), admin: { width: '33%' } } as Field,
        {
          name: 'stackable',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            width: '33%',
            description: 'Promotions: also on contract and price-list prices.',
          },
        },
        {
          name: 'markets',
          type: 'select',
          hasMany: true,
          options: MARKET_CODES.map((c) => ({ label: c.toUpperCase(), value: c })),
          admin: { width: '33%', description: 'Empty means every market.' },
        },
      ],
    },
    validity,
  ],
}
