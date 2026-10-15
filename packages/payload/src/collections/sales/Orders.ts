import type { CollectionConfig, Field } from 'payload'
import { FAILURE_REASONS, FULFILMENT_STATUSES, ORDER_STATUSES, REFUND_STATUSES } from '@alpha/core'
import { isStaff, nobody, staffField, systemWritten } from '../../access'
import { LOCALE_CODES, MARKET_CODES } from '../../markets/codes'

const system = { create: systemWritten, update: systemWritten }
const minor = (name: string, label?: string): Field => ({
  name,
  ...(label ? { label } : {}),
  type: 'number',
  required: true,
  access: system,
  admin: { readOnly: true },
})
const readOnly = { readOnly: true } as const

/**
 * A storefront order (docs/tasks/0009). Written only by the checkout service (system); staff
 * read it and may add notes. Money is minor units of `currency` with `decimals` beside it.
 * Orders are never deleted; failed and expired checkouts stay for the record.
 */
export const Orders: CollectionConfig = {
  slug: 'orders',
  labels: { singular: 'Order', plural: 'Orders' },
  admin: {
    group: 'Sales',
    useAsTitle: 'number',
    defaultColumns: ['number', 'status', 'market', 'createdAt'],
  },
  access: { read: isStaff, create: nobody, update: isStaff, delete: nobody },
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
          options: ORDER_STATUSES.map((s) => ({ label: s, value: s })),
          access: system,
          admin: { ...readOnly, width: '25%' },
        },
        {
          name: 'failureReason',
          type: 'select',
          options: FAILURE_REASONS.map((s) => ({ label: s, value: s })),
          access: system,
          admin: { ...readOnly, width: '25%' },
        },
        {
          name: 'channel',
          type: 'select',
          required: true,
          defaultValue: 'web',
          options: [{ label: 'web', value: 'web' }],
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
          admin: { ...readOnly, width: '25%' },
        },
        {
          name: 'locale',
          type: 'select',
          required: true,
          options: LOCALE_CODES.map((c) => ({ label: c, value: c })),
          access: system,
          admin: { ...readOnly, width: '25%' },
        },
        {
          name: 'currency',
          type: 'text',
          required: true,
          access: system,
          admin: { ...readOnly, width: '25%' },
        },
        {
          name: 'decimals',
          type: 'number',
          required: true,
          access: system,
          admin: { ...readOnly, width: '25%' },
        },
      ],
    },
    {
      name: 'contact',
      type: 'group',
      access: system,
      admin: readOnly,
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'name', type: 'text' },
            { name: 'email', type: 'email' },
            { name: 'phone', type: 'text' },
          ],
        },
      ],
    },
    {
      name: 'address',
      type: 'json',
      access: system,
      admin: { ...readOnly, description: 'Fields of the market’s address scheme, as entered.' },
    },
    { name: 'paymentMethod', type: 'text', access: system, admin: readOnly },
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
              access: system,
              admin: { ...readOnly, width: '30%' },
            },
            {
              name: 'sku',
              type: 'text',
              required: true,
              access: system,
              admin: { ...readOnly, width: '20%' },
            },
            {
              name: 'title',
              type: 'text',
              required: true,
              access: system,
              admin: { ...readOnly, width: '30%' },
            },
            {
              name: 'qty',
              type: 'number',
              required: true,
              access: system,
              admin: { ...readOnly, width: '20%' },
            },
          ],
        },
        { type: 'row', fields: [minor('unitPrice'), minor('lineTotal'), minor('vat', 'VAT')] },
      ],
    },
    {
      name: 'totals',
      type: 'group',
      access: system,
      admin: readOnly,
      fields: [
        {
          type: 'row',
          fields: [minor('subtotal'), minor('vat', 'VAT'), minor('delivery'), minor('total')],
        },
      ],
    },
    {
      name: 'payment',
      type: 'group',
      access: system,
      admin: readOnly,
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'provider', type: 'text' },
            { name: 'intentId', type: 'text', index: true },
            {
              name: 'status',
              type: 'select',
              options: ['pending', 'authorised', 'captured', 'declined', 'failed'].map((s) => ({
                label: s,
                value: s,
              })),
            },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'fulfilment',
          type: 'select',
          required: true,
          index: true,
          defaultValue: 'awaiting',
          options: FULFILMENT_STATUSES.map((s) => ({ label: s, value: s })),
          access: system,
          admin: {
            ...readOnly,
            width: '33%',
            description: 'Pick, ship and deliver on the ops screens (/ops/orders/).',
          },
        },
        {
          name: 'shipment',
          type: 'relationship',
          relationTo: 'shipments',
          access: system,
          admin: { ...readOnly, width: '33%' },
        },
        {
          name: 'cancelReason',
          type: 'text',
          access: system,
          admin: { ...readOnly, width: '33%' },
        },
      ],
    },
    {
      name: 'refund',
      type: 'group',
      access: system,
      admin: readOnly,
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'status',
              type: 'select',
              required: true,
              defaultValue: 'none',
              options: REFUND_STATUSES.map((s) => ({ label: s, value: s })),
              admin: {
                width: '25%',
                description: '`manual`: refund it in the gateway by hand, then note it here.',
              },
            },
            { name: 'amount', type: 'number', admin: { width: '25%' } },
            { name: 'reference', type: 'text', admin: { width: '25%' } },
            { name: 'error', type: 'text', admin: { width: '25%' } },
          ],
        },
      ],
    },
    {
      name: 'reservations',
      type: 'json',
      access: system,
      admin: { ...readOnly, description: 'Ledger reservation ids holding this order’s stock.' },
    },
    { name: 'unavailableSkus', type: 'json', access: system, admin: readOnly },
    {
      name: 'holdExpiresAt',
      type: 'date',
      access: system,
      admin: { ...readOnly, description: 'Cart holds lapse at this time while paying.' },
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
      name: 'accessTokenHash',
      type: 'text',
      required: true,
      access: { ...system, read: staffField },
      admin: { hidden: true },
    },
    { name: 'notes', type: 'textarea', admin: { description: 'Staff notes.' } },
  ],
}
