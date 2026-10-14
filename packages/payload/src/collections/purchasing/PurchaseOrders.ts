import { APIError, type CollectionBeforeChangeHook, type CollectionConfig } from 'payload'
import {
  PO_STATUSES,
  ReceivingError,
  assertManualPoStatusChange,
  linesEditable,
  type PoStatus,
} from '@alpha/core'
import { canReadCost, isStaff, nobody, systemWritten } from '../../access'
import { currencyField, decimalsField, wholeNumber } from './fields'

interface LineData {
  id?: string | null
  sku?: string | null
  qtyOrdered?: number | null
  unitCost?: number | null
  serialised?: boolean | null
  qtyReceived?: number | null
}

const lineKey = (l: LineData) =>
  `${l.id ?? ''}|${l.sku ?? ''}|${l.qtyOrdered ?? ''}|${l.unitCost ?? ''}|${l.serialised ? 1 : 0}`

/**
 * Staff move a PO through draft → ordered → closed (or cancel it); receiving sets
 * `partially_received` and `received`. What was ordered is frozen once the PO is ordered.
 */
export const guardPurchaseOrderChanges: CollectionBeforeChangeHook = ({
  data,
  originalDoc,
  operation,
}) => {
  const from = ((originalDoc?.status as PoStatus | undefined) ?? 'draft') as PoStatus
  const to = ((data.status as PoStatus | undefined) ?? from) as PoStatus
  const before = (originalDoc?.lines ?? []) as LineData[]
  try {
    if (operation === 'create') {
      if (to !== 'draft' && to !== 'ordered') assertManualPoStatusChange('draft', to, false)
    } else {
      assertManualPoStatusChange(
        from,
        to,
        before.some((l) => (l.qtyReceived ?? 0) > 0),
      )
    }
  } catch (error) {
    if (error instanceof ReceivingError) throw new APIError(error.message, 400)
    throw error
  }
  if (operation === 'update' && !linesEditable(from) && Array.isArray(data.lines)) {
    const after = data.lines as LineData[]
    if (
      after.length !== before.length ||
      after.some((l, i) => lineKey(l) !== lineKey(before[i] ?? {}))
    ) {
      throw new APIError(
        `Lines are frozen once a purchase order is ${from}. Raise a new order for changes.`,
        400,
      )
    }
  }
  return data
}

export const PurchaseOrders: CollectionConfig = {
  slug: 'purchase-orders',
  labels: { singular: 'Purchase order', plural: 'Purchase orders' },
  admin: {
    group: 'Purchasing',
    useAsTitle: 'number',
    defaultColumns: ['number', 'supplier', 'warehouse', 'status', 'expectedAt'],
  },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: nobody },
  hooks: { beforeChange: [guardPurchaseOrderChanges] },
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
          admin: { width: '25%', description: 'e.g. PO-2026-0100.' },
        },
        {
          name: 'supplier',
          type: 'relationship',
          relationTo: 'suppliers',
          required: true,
          admin: { width: '40%' },
        },
        {
          name: 'warehouse',
          type: 'relationship',
          relationTo: 'warehouses',
          required: true,
          admin: { width: '35%', description: 'Destination.' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        currencyField(),
        decimalsField,
        {
          name: 'expectedAt',
          type: 'date',
          admin: { width: '30%', description: 'Expected arrival; feeds stock ETAs.' },
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          index: true,
          defaultValue: 'draft',
          options: PO_STATUSES.map((s) => ({ label: s, value: s })),
          admin: { width: '35%', description: 'Receiving sets partially received and received.' },
        },
      ],
    },
    {
      name: 'lines',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'sku', type: 'text', required: true, index: true, admin: { width: '25%' } },
            { name: 'description', type: 'text', admin: { width: '35%' } },
            {
              name: 'qtyOrdered',
              type: 'number',
              required: true,
              admin: { width: '15%' },
              validate: wholeNumber('Quantity ordered', 1),
            },
            {
              name: 'unitCost',
              type: 'number',
              required: true,
              access: { read: canReadCost },
              admin: { width: '15%', description: 'Minor units of the order currency.' },
              validate: wholeNumber('Unit cost', 0),
            },
            { name: 'serialised', type: 'checkbox', defaultValue: false, admin: { width: '10%' } },
          ],
        },
        {
          name: 'qtyReceived',
          type: 'number',
          defaultValue: 0,
          // Written only by receiving (in its own transaction); nobody types it.
          access: { create: systemWritten, update: systemWritten },
          admin: { readOnly: true, description: 'Units booked by posted goods receipts.' },
        },
      ],
    },
    { name: 'notes', type: 'textarea' },
  ],
}
