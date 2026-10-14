import type { CollectionConfig } from 'payload'
import { isStaff, publicRead } from '../access'
import {
  normalizeLegacyPath,
  normalizeLegacyQuery,
  validateLegacyPath,
  validateLegacyTarget,
} from '../legacy/normalize'

export const LEGACY_REDIRECTS_SLUG = 'legacy-redirects'

/**
 * Old alphaaudios.com URLs (`/brand?bid=13`, `/collection?catid=53`) mapped to their new
 * pages. Payload's redirects plugin matches paths only, so query-string URLs are resolved from
 * this table by the storefront's legacy route handlers. Seeded from a crawl before cut-over.
 *
 * Source path and query are normalized on save (lower-case, tracking parameters dropped, keys
 * sorted) so lookups match however the old link was shared.
 */
export const LegacyRedirects: CollectionConfig = {
  slug: LEGACY_REDIRECTS_SLUG,
  labels: { singular: 'Legacy redirect', plural: 'Legacy redirects' },
  admin: {
    group: 'Settings',
    useAsTitle: 'sourcePath',
    defaultColumns: ['sourcePath', 'sourceQuery', 'target', 'status'],
    description: 'Old site URLs with query strings, redirected to their new pages.',
  },
  access: { read: publicRead, create: isStaff, update: isStaff, delete: isStaff },
  indexes: [{ fields: ['sourcePath', 'sourceQuery'], unique: true }],
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) return data
        if (typeof data['sourcePath'] === 'string') {
          data['sourcePath'] = normalizeLegacyPath(data['sourcePath'])
        }
        data['sourceQuery'] = normalizeLegacyQuery(
          typeof data['sourceQuery'] === 'string' ? data['sourceQuery'] : '',
        )
        return data
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'sourcePath',
          type: 'text',
          required: true,
          index: true,
          admin: { width: '40%', placeholder: '/brand' },
          validate: (value: unknown) => validateLegacyPath(value),
        },
        {
          name: 'sourceQuery',
          type: 'text',
          admin: {
            width: '60%',
            placeholder: 'bid=13',
            description: 'Without the "?". Tracking parameters are removed automatically.',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'target',
          type: 'text',
          required: true,
          admin: { width: '70%', placeholder: '/ae/en/brands/mcintosh' },
          validate: (value: unknown) => validateLegacyTarget(value),
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: '301',
          options: [
            { label: '301 Moved permanently', value: '301' },
            { label: '302 Found (temporary)', value: '302' },
          ],
          admin: { width: '30%' },
        },
      ],
    },
  ],
}
