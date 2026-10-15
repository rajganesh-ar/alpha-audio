import type { CollectionConfig, Field } from 'payload'
import { QUOTE_STATUSES } from '@alpha/core'
import { isStaff, nobody, staffField, staffOrOwnCompanyDocs, systemWritten } from '../../access'
import { MARKET_CODES } from '../../markets/codes'

const system = { create: systemWritten, update: systemWritten }
const readOnly = { readOnly: true } as const
const minor = (name: string, label?: string): Field => ({
  name,
  ...(label ? { label } : {}),
  type: 'number',
  access: system,
  admin: readOnly,
})

/**
 * A dealer quote (docs/tasks/0016, ADR 0016): the company's prices, trace and FX locked for its
 * validity, with stock held where it could be. Written only by the quote service (system);
 * staff read all and may keep notes; company users read their own company's quotes. Prices are
 * net (VAT on top), minor units of `currency` with `decimals` beside them. Never deleted.
 */
export const Quotes: CollectionConfig = {
  slug: 'quotes',
  labels: { singular: 'Dealer quote', plural: 'Dealer quotes' },
  admin: {
    group: 'Trade',
    useAsTitle: 'number',
    defaultColumns: ['number', 'company', 'status', 'validUntil'],
  },
  access: { read: staffOrOwnCompanyDocs, create: nobody, update: isStaff, delete: nobody },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'number',
          type: 'text',
          required: true,
          unique: true,
          index: true,
          access: system,
          admin: { ...readOnly, width: '25%' },
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          index: true,
          options: QUOTE_STATUSES.map((s) => ({ label: s, value: s })),
          access: system,
          admin: { ...readOnly, width: '25%' },
        },
        {
          name: 'company',
          type: 'relationship',
          relationTo: 'companies',
          required: true,
          index: true,
          access: system,
          admin: { ...readOnly, width: '25%' },
        },
        {
          name: 'createdBy',
          type: 'relationship',
          relationTo: 'company-users',
          required: true,
          access: system,
          admin: { ...readOnly, width: '25%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'market',
          type: 'select',
          required: true,
          options: MARKET_CODES.map((c) => ({ label: c.toUpperCase(), value: c })),
          access: system,
          admin: { ...readOnly, width: '20%' },
        },
        {
          name: 'currency',
          type: 'text',
          required: true,
          access: system,
          admin: { ...readOnly, width: '20%' },
        },
        {
          name: 'decimals',
          type: 'number',
          required: true,
          access: system,
          admin: { ...readOnly, width: '20%' },
        },
        {
          name: 'vatRate',
          label: 'VAT rate (%)',
          type: 'number',
          required: true,
          access: system,
          admin: { ...readOnly, width: '20%' },
        },
        {
          name: 'reference',
          label: 'Dealer’s reference',
          type: 'text',
          access: system,
          admin: { ...readOnly, width: '20%' },
        },
      ],
    },
    { name: 'note', label: 'Dealer’s note', type: 'textarea', access: system, admin: readOnly },
    {
      name: 'lines',
      type: 'array',
      access: system,
      admin: readOnly,
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'product',
              type: 'relationship',
              relationTo: 'products',
              admin: { width: '25%' },
            },
            { name: 'sku', type: 'text', required: true, admin: { width: '20%' } },
            { name: 'title', type: 'text', required: true, admin: { width: '35%' } },
            { name: 'qty', type: 'number', required: true, admin: { width: '20%' } },
          ],
        },
        {
          type: 'row',
          fields: [
            minor('unitNet', 'Unit (net)'),
            minor('lineNet', 'Line (net)'),
            minor('vat', 'VAT'),
            { name: 'basis', type: 'text' },
            { name: 'priceStatus', type: 'text' },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'held',
              type: 'checkbox',
              admin: { width: '20%', description: 'Stock held for this line.' },
            },
            {
              name: 'trace',
              type: 'json',
              admin: {
                width: '80%',
                description: 'The price engine’s trace, as the company saw it.',
              },
            },
          ],
        },
      ],
    },
    {
      name: 'totals',
      type: 'group',
      access: system,
      admin: readOnly,
      fields: [{ type: 'row', fields: [minor('net'), minor('vat', 'VAT'), minor('gross')] }],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'validUntil',
          type: 'date',
          required: true,
          index: true,
          access: system,
          admin: {
            ...readOnly,
            width: '33%',
            date: { pickerAppearance: 'dayAndTime' },
            description: 'Prices are locked and stock held until then.',
          },
        },
        {
          name: 'orderNumber',
          label: 'Became order',
          type: 'text',
          access: system,
          admin: { ...readOnly, width: '33%' },
        },
        {
          name: 'fxLockedAt',
          label: 'FX locked at',
          type: 'date',
          access: system,
          admin: { ...readOnly, width: '33%', date: { pickerAppearance: 'dayAndTime' } },
        },
      ],
    },
    {
      name: 'fxRates',
      label: 'FX rates locked (AED per unit)',
      type: 'json',
      access: { ...system, read: staffField },
      admin: readOnly,
    },
    {
      name: 'reservations',
      type: 'json',
      access: { ...system, read: staffField },
      admin: { ...readOnly, description: 'Ledger holds by line (null where not held).' },
    },
    {
      name: 'idempotencyKey',
      type: 'text',
      required: true,
      unique: true,
      access: { ...system, read: staffField },
      admin: { hidden: true },
    },
    {
      name: 'staffNotes',
      type: 'textarea',
      access: { read: staffField },
      admin: { description: 'Staff notes; never shown to the dealer.' },
    },
  ],
}
