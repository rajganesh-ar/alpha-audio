import type { CollectionConfig } from 'payload'
import { NOTIFICATION_TEMPLATES } from '@alpha/core'
import { isStaff, nobody, systemWritten } from '../../access'
import { LOCALE_CODES } from '../../markets/codes'

const system = { create: systemWritten, update: systemWritten }

/**
 * The customer notification outbox (docs/tasks/0010). A row is written once per order and
 * template (`key` is unique), and the `sendNotification` job delivers it with retries. Staff
 * read it for support; only system code writes.
 */
export const Notifications: CollectionConfig = {
  slug: 'notifications',
  labels: { singular: 'Notification', plural: 'Notifications' },
  admin: {
    group: 'Sales',
    useAsTitle: 'key',
    defaultColumns: ['key', 'template', 'status', 'attempts', 'sentAt'],
  },
  access: { read: isStaff, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: 'key', type: 'text', required: true, unique: true, access: system },
    {
      type: 'row',
      fields: [
        {
          name: 'order',
          type: 'relationship',
          relationTo: 'orders',
          required: true,
          index: true,
          access: system,
          admin: { width: '25%' },
        },
        {
          name: 'template',
          type: 'select',
          required: true,
          options: NOTIFICATION_TEMPLATES.map((t) => ({ label: t, value: t })),
          access: system,
          admin: { width: '25%' },
        },
        {
          name: 'channel',
          type: 'select',
          required: true,
          defaultValue: 'email',
          options: [{ label: 'email', value: 'email' }],
          access: system,
          admin: { width: '25%' },
        },
        {
          name: 'locale',
          type: 'select',
          required: true,
          options: LOCALE_CODES.map((l) => ({ label: l, value: l })),
          access: system,
          admin: { width: '25%' },
        },
      ],
    },
    { name: 'to', type: 'email', required: true, access: system },
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'queued',
          index: true,
          options: ['queued', 'sent', 'failed'].map((s) => ({ label: s, value: s })),
          access: system,
          admin: { width: '25%' },
        },
        {
          name: 'attempts',
          type: 'number',
          required: true,
          defaultValue: 0,
          access: system,
          admin: { width: '25%' },
        },
        { name: 'sentAt', type: 'date', access: system, admin: { width: '25%' } },
        { name: 'lastError', type: 'text', access: system, admin: { width: '25%' } },
      ],
    },
  ],
}
