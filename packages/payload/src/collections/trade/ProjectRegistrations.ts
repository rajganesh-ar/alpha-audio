import type { CollectionConfig } from 'payload'
import { PROJECT_STATUSES } from '@alpha/core'
import { isStaff, nobody, staffField, staffOrOwnCompanyDocs, systemWritten } from '../../access'
import { MARKET_CODES } from '../../markets/codes'

const system = { create: systemWritten, update: systemWritten }
const readOnly = { readOnly: true } as const

/**
 * A dealer's project registration (docs/tasks/0017, ADR 0017). Written only by the project
 * service (system): dealers register, staff approve with project prices on the ops screen
 * (/ops/projects/) or reject. Company users read their own company's; staff read all. Project
 * prices are net, minor units of the market currency.
 */
export const ProjectRegistrations: CollectionConfig = {
  slug: 'project-registrations',
  labels: { singular: 'Project registration', plural: 'Project registrations' },
  admin: {
    group: 'Trade',
    useAsTitle: 'number',
    defaultColumns: ['number', 'name', 'company', 'status', 'validUntil'],
    description: 'Approve or reject registrations, with project prices, on /ops/projects/.',
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
          options: PROJECT_STATUSES.map((s) => ({ label: s, value: s })),
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
          name: 'registeredBy',
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
          name: 'name',
          type: 'text',
          required: true,
          access: system,
          admin: { ...readOnly, width: '40%' },
        },
        {
          name: 'endCustomer',
          label: 'End customer',
          type: 'text',
          required: true,
          access: system,
          admin: { ...readOnly, width: '30%' },
        },
        { name: 'city', type: 'text', access: system, admin: { ...readOnly, width: '15%' } },
        {
          name: 'market',
          type: 'select',
          required: true,
          options: MARKET_CODES.map((c) => ({ label: c.toUpperCase(), value: c })),
          access: system,
          admin: { ...readOnly, width: '15%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'expectedClose',
          label: 'Expected close',
          type: 'date',
          required: true,
          access: system,
          admin: { ...readOnly, width: '33%' },
        },
        {
          name: 'validUntil',
          label: 'Project prices valid until',
          type: 'date',
          index: true,
          access: system,
          admin: { ...readOnly, width: '33%', date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'decidedAt',
          type: 'date',
          access: system,
          admin: { ...readOnly, width: '33%', date: { pickerAppearance: 'dayAndTime' } },
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
            { name: 'title', type: 'text', required: true, admin: { width: '25%' } },
            { name: 'qty', type: 'number', required: true, admin: { width: '10%' } },
            {
              name: 'projectPrice',
              label: 'Project price (net)',
              type: 'number',
              admin: { width: '20%', description: 'Minor units; set on approval.' },
            },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'decidedBy',
          type: 'relationship',
          relationTo: 'users',
          access: { ...system, read: staffField },
          admin: { ...readOnly, width: '50%' },
        },
        {
          name: 'decisionNote',
          label: 'Decision note (shown to the dealer)',
          type: 'text',
          access: system,
          admin: { ...readOnly, width: '50%' },
        },
      ],
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
