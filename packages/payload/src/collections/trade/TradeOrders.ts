import type { CollectionConfig, Field } from 'payload'
import { TRADE_ORDER_STATUSES } from '@alpha/core'
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
 * A dealer order on account (docs/tasks/0015, ADR 0015). Written only by the trade order
 * service (system); staff read all and may keep notes; company users read their own company's
 * orders. Prices are net (VAT on top), minor units of `currency` with `decimals` beside them.
 * Never deleted.
 */
export const TradeOrders: CollectionConfig = {
  slug: 'trade-orders',
  labels: { singular: 'Dealer order', plural: 'Dealer orders' },
  admin: {
    group: 'Trade',
    useAsTitle: 'number',
    defaultColumns: ['number', 'company', 'status', 'createdAt'],
    description: 'Approve or reject what waits for Alpha on the ops screen (/ops/trade-orders/).',
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
          options: TRADE_ORDER_STATUSES.map((s) => ({ label: s, value: s })),
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
          name: 'placedBy',
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
          name: 'poNumber',
          label: 'PO reference',
          type: 'text',
          access: system,
          admin: { ...readOnly, width: '20%' },
        },
      ],
    },
    {
      name: 'project',
      label: 'Project registration',
      type: 'text',
      index: true,
      access: system,
      admin: { ...readOnly, description: 'Priced at this project’s prices (docs/tasks/0017).' },
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
          name: 'trace',
          type: 'json',
          admin: { description: 'The price engine’s trace, as the company saw it.' },
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
      name: 'approvals',
      type: 'json',
      access: system,
      admin: {
        ...readOnly,
        description: 'Each needed approval: kind (company or alpha), reason, status, who and when.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'failureReason',
          type: 'select',
          options: [{ label: 'stock-lost', value: 'stock-lost' }],
          access: system,
          admin: { ...readOnly, width: '33%' },
        },
        {
          name: 'closedReason',
          label: 'Reject or cancel reason',
          type: 'text',
          access: system,
          admin: { ...readOnly, width: '33%' },
        },
        {
          name: 'holdExpiresAt',
          type: 'date',
          access: system,
          admin: {
            ...readOnly,
            width: '33%',
            description: 'Stock held for a pending order lapses at this time.',
          },
        },
      ],
    },
    {
      name: 'reservations',
      type: 'json',
      access: { ...system, read: staffField },
      admin: { ...readOnly, description: 'Ledger reservation ids holding this order’s stock.' },
    },
    { name: 'unavailableSkus', type: 'json', access: system, admin: readOnly },
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
