import type { CollectionConfig } from 'payload'

/** Media stored in S3-compatible storage (MinIO locally, R2 in cloud). */
export const Media: CollectionConfig = {
  slug: 'media',
  access: { read: () => true },
  upload: true,
  fields: [{ name: 'alt', type: 'text', required: true, localized: true }],
}
