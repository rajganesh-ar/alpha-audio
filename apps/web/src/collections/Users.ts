import type { CollectionConfig } from 'payload'

/** Staff accounts. Roles and 2FA arrive with the access-control task; placeholder for task 0001. */
export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: { useAsTitle: 'email' },
  fields: [{ name: 'name', type: 'text' }],
}
