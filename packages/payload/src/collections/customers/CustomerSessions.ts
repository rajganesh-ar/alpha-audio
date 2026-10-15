import type { CollectionConfig } from 'payload'
import { nobody } from '../../access'

/**
 * Signed-in storefront sessions (docs/tasks/0012). The browser holds a random token; only its
 * SHA-256 is here. System only: written and read by system/accounts, never through the API.
 */
export const CustomerSessions: CollectionConfig = {
  slug: 'customer-sessions',
  labels: { singular: 'Customer session', plural: 'Customer sessions' },
  admin: { group: 'Customers', hidden: true },
  access: { read: nobody, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: 'tokenHash', type: 'text', required: true, unique: true },
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      required: true,
      index: true,
    },
    { name: 'expiresAt', type: 'date', required: true, index: true },
    { name: 'revokedAt', type: 'date' },
  ],
}
