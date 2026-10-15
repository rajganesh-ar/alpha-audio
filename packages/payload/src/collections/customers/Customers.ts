import type { CollectionConfig } from 'payload'
import { isStaff, nobody, staffOrSelf, systemWritten } from '../../access'
import { LOCALE_CODES, MARKET_CODES } from '../../markets/codes'
import { customerSessionStrategy } from './strategy'

const system = { create: systemWritten, update: systemWritten }

/**
 * Storefront customers (docs/tasks/0012). No passwords: a customer signs in with a one-time link
 * emailed to them (spec: Security → Customers), so `email` is verified by construction. Payload
 * auth with only the session strategy; the admin stays staff-only (`admin.user: users`).
 * Staff read and correct records for support; a customer reads only their own.
 */
export const Customers: CollectionConfig = {
  slug: 'customers',
  labels: { singular: 'Customer', plural: 'Customers' },
  auth: {
    disableLocalStrategy: true,
    strategies: [customerSessionStrategy],
  },
  admin: {
    group: 'Customers',
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'market', 'lastSignInAt'],
  },
  access: { read: staffOrSelf, create: nobody, update: isStaff, delete: nobody },
  fields: [
    { name: 'email', type: 'email', required: true, unique: true, index: true, access: system },
    {
      type: 'row',
      fields: [
        { name: 'name', type: 'text', admin: { width: '50%' } },
        { name: 'phone', type: 'text', admin: { width: '50%' } },
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
          admin: { width: '33%' },
        },
        {
          name: 'locale',
          type: 'select',
          required: true,
          options: LOCALE_CODES.map((l) => ({ label: l, value: l })),
          access: system,
          admin: { width: '33%' },
        },
        {
          name: 'lastSignInAt',
          type: 'date',
          access: system,
          admin: { width: '33%', readOnly: true },
        },
      ],
    },
    {
      name: 'marketingConsent',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Opted in to marketing (PDPL consent). Order emails are sent regardless.',
      },
    },
  ],
}
