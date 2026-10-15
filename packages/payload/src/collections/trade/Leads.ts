import type { CollectionConfig } from 'payload'
import { LEAD_OUTCOMES, LEAD_SOURCES, LEAD_STATUSES } from '@alpha/core'
import {
  canReadLeadContact,
  isStaff,
  nobody,
  staffField,
  staffOrOfferedCompany,
  systemWritten,
} from '../../access'
import { LOCALE_CODES, MARKET_CODES } from '../../markets/codes'

const system = { create: systemWritten, update: systemWritten }
const readOnly = { readOnly: true } as const

/**
 * A storefront enquiry routed to a dealer or kept with Alpha (docs/tasks/0018, ADR 0018).
 * Written only by the lead service (system). Staff read all; a company reads the leads offered
 * to or accepted by it, and the shopper's contact only after accepting.
 */
export const Leads: CollectionConfig = {
  slug: 'leads',
  labels: { singular: 'Lead', plural: 'Leads' },
  admin: {
    group: 'Trade',
    useAsTitle: 'number',
    defaultColumns: ['number', 'status', 'brand', 'city', 'offeredTo', 'createdAt'],
  },
  access: { read: staffOrOfferedCompany, create: nobody, update: isStaff, delete: nobody },
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
          admin: { ...readOnly, width: '20%' },
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          index: true,
          options: LEAD_STATUSES.map((s) => ({ label: s, value: s })),
          access: system,
          admin: { ...readOnly, width: '20%' },
        },
        {
          name: 'source',
          type: 'select',
          required: true,
          options: LEAD_SOURCES.map((s) => ({ label: s, value: s })),
          access: system,
          admin: { ...readOnly, width: '20%' },
        },
        {
          name: 'routing',
          type: 'select',
          required: true,
          options: [
            { label: 'alpha', value: 'alpha' },
            { label: 'dealer', value: 'dealer' },
          ],
          access: system,
          admin: { ...readOnly, width: '20%' },
        },
        {
          name: 'market',
          type: 'select',
          required: true,
          options: MARKET_CODES.map((c) => ({ label: c.toUpperCase(), value: c })),
          access: system,
          admin: { ...readOnly, width: '10%' },
        },
        {
          name: 'locale',
          type: 'select',
          required: true,
          options: LOCALE_CODES.map((c) => ({ label: c, value: c })),
          access: system,
          admin: { ...readOnly, width: '10%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'brand',
          type: 'relationship',
          relationTo: 'brands',
          access: system,
          admin: { ...readOnly, width: '33%' },
        },
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
          access: system,
          admin: { ...readOnly, width: '33%' },
        },
        { name: 'city', type: 'text', access: system, admin: { ...readOnly, width: '33%' } },
      ],
    },
    { name: 'message', type: 'textarea', access: system, admin: readOnly },
    {
      name: 'contact',
      type: 'group',
      access: { ...system, read: canReadLeadContact },
      admin: readOnly,
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'name', type: 'text' },
            { name: 'email', type: 'email', index: true },
            { name: 'phone', type: 'text' },
          ],
        },
      ],
    },
    {
      name: 'consent',
      type: 'checkbox',
      defaultValue: false,
      access: system,
      admin: { ...readOnly, description: 'The shopper agreed to be contacted by a partner.' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'offeredTo',
          type: 'relationship',
          relationTo: 'companies',
          index: true,
          access: system,
          admin: { ...readOnly, width: '33%' },
        },
        {
          name: 'acceptBy',
          type: 'date',
          index: true,
          access: system,
          admin: { ...readOnly, width: '33%', date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'outcome',
          type: 'select',
          options: LEAD_OUTCOMES.map((s) => ({ label: s, value: s })),
          access: system,
          admin: { ...readOnly, width: '17%' },
        },
        {
          name: 'value',
          type: 'number',
          access: system,
          admin: { ...readOnly, width: '17%', description: 'Won value, minor units.' },
        },
      ],
    },
    {
      name: 'attempts',
      type: 'json',
      access: { ...system, read: staffField },
      admin: { ...readOnly, description: 'Each offer: company, when, deadline and result.' },
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
      name: 'requestIpHash',
      type: 'text',
      index: true,
      access: { ...system, read: staffField },
      admin: { hidden: true },
    },
    {
      name: 'staffNotes',
      type: 'textarea',
      access: { read: staffField },
      admin: { description: 'Staff notes; never shown to a dealer.' },
    },
  ],
}
