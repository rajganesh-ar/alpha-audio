import { APIError, type CollectionBeforeChangeHook, type CollectionConfig } from 'payload'
import { RECEIPT_EXCEPTIONS, RECEIPT_STATUSES } from '@alpha/core'
import { isStaff, nobody, systemWritten } from '../../access'
import { wholeNumber } from './fields'

/** A posted receipt is a ledger document: it never changes afterwards. */
export const freezePostedReceipts: CollectionBeforeChangeHook = ({
  originalDoc,
  operation,
  data,
}) => {
  if (operation === 'update' && originalDoc?.status === 'posted') {
    throw new APIError(
      `Goods receipt ${String(originalDoc.number)} is posted and can no longer change.`,
      400,
    )
  }
  return data
}

const stringList = (label: string) => (value: unknown) =>
  value === undefined ||
  value === null ||
  (Array.isArray(value) && value.every((v) => typeof v === 'string'))
    ? true
    : `${label} must be a list of serial numbers.`

const system = { create: systemWritten, update: systemWritten }

/**
 * What arrived at the dock against a purchase order. Staff (or the receiving PWA) fill in a
 * draft; posting through the receiving service books it into the ledger and freezes it.
 */
export const GoodsReceipts: CollectionConfig = {
  slug: 'goods-receipts',
  labels: { singular: 'Goods receipt', plural: 'Goods receipts' },
  admin: {
    group: 'Purchasing',
    useAsTitle: 'number',
    defaultColumns: ['number', 'purchaseOrder', 'location', 'status', 'postedAt'],
  },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: nobody },
  hooks: { beforeChange: [freezePostedReceipts] },
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
          admin: { width: '25%', description: 'e.g. GR-2026-0001.' },
        },
        {
          name: 'purchaseOrder',
          type: 'relationship',
          relationTo: 'purchase-orders',
          required: true,
          admin: { width: '40%' },
        },
        {
          name: 'location',
          type: 'relationship',
          relationTo: 'locations',
          required: true,
          admin: { width: '35%', description: 'Receiving dock.' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'draft',
          options: RECEIPT_STATUSES.map((s) => ({ label: s, value: s })),
          access: system,
          admin: { width: '20%', readOnly: true, description: 'Set by posting.' },
        },
        { name: 'postedAt', type: 'date', access: system, admin: { width: '20%', readOnly: true } },
        {
          name: 'postedBy',
          type: 'relationship',
          relationTo: 'users',
          access: system,
          admin: { width: '20%', readOnly: true },
        },
        {
          name: 'putawayAt',
          type: 'date',
          access: system,
          admin: { width: '20%', readOnly: true },
        },
        {
          name: 'putawayLocation',
          type: 'relationship',
          relationTo: 'locations',
          access: system,
          admin: { width: '20%', readOnly: true },
        },
      ],
    },
    {
      name: 'lines',
      type: 'array',
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'poLine',
              type: 'text',
              required: true,
              admin: { width: '30%', description: 'Id of the purchase order line.' },
            },
            {
              name: 'sku',
              type: 'text',
              required: true,
              admin: { width: '30%', description: 'What arrived.' },
            },
            {
              name: 'qty',
              type: 'number',
              required: true,
              admin: { width: '15%' },
              validate: wholeNumber('Quantity', 1),
            },
          ],
        },
        {
          name: 'serials',
          type: 'json',
          validate: stringList('Serials'),
          admin: { description: 'One per unit for serialised lines.' },
        },
        {
          name: 'exceptions',
          type: 'array',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'type',
                  type: 'select',
                  required: true,
                  options: RECEIPT_EXCEPTIONS.map((e) => ({ label: e, value: e })),
                  admin: { width: '25%' },
                },
                {
                  name: 'qty',
                  type: 'number',
                  admin: { width: '15%' },
                  validate: wholeNumber('Quantity', 0),
                },
                {
                  name: 'serials',
                  type: 'json',
                  validate: stringList('Serials'),
                  admin: { width: '30%' },
                },
                { name: 'note', type: 'text', admin: { width: '30%' } },
              ],
            },
          ],
        },
      ],
    },
  ],
}
