import type { CollectionConfig } from 'payload'
import { LOCALE_CODES, MARKET_CODES } from '../../markets/codes'
import { nobody } from '../../access'

/**
 * One-time sign-in links (docs/tasks/0012): the hash of the token in the emailed link, who asked
 * for it, when it expires and when it was used. `ipHash` (salted SHA-256, never the address)
 * limits requests per network. System only.
 */
export const SignInLinks: CollectionConfig = {
  slug: 'sign-in-links',
  labels: { singular: 'Sign-in link', plural: 'Sign-in links' },
  admin: { group: 'Customers', hidden: true },
  access: { read: nobody, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: 'tokenHash', type: 'text', required: true, unique: true },
    { name: 'email', type: 'email', required: true, index: true },
    {
      name: 'market',
      type: 'select',
      required: true,
      options: MARKET_CODES.map((c) => ({ label: c, value: c })),
    },
    {
      name: 'locale',
      type: 'select',
      required: true,
      options: LOCALE_CODES.map((l) => ({ label: l, value: l })),
    },
    { name: 'ipHash', type: 'text', index: true },
    { name: 'expiresAt', type: 'date', required: true },
    { name: 'usedAt', type: 'date' },
  ],
}
