import type { CollectionConfig } from 'payload'
import { canEditCatalog, isStaff, nobody, publishedOrStaff } from '../../access'
import { revalidateStorefront } from '../../hooks/revalidateStorefront'
import { MARKET_CODES } from '../../markets/codes'
import { arabicReviewField, seoField, slugField } from '../catalog/fields'

export const PAGE_KINDS = ['legal'] as const
export type PageKind = (typeof PAGE_KINDS)[number]

const revalidate = revalidateStorefront('content')

/**
 * Editorial pages (docs/tasks/0011). Legal pages first: terms, privacy, returns and warranty at
 * `/{m}/{l}/legal/{slug}/`. Published per market (`markets`), so one market can carry its own
 * returns policy; a page not published in a market 404s there. `reviewedAt` is the last legal
 * review, shown on the page.
 */
export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: 'Page', plural: 'Pages' },
  admin: {
    group: 'Content',
    useAsTitle: 'title',
    defaultColumns: ['title', 'kind', 'slug', 'markets', '_status'],
  },
  versions: { drafts: true },
  access: {
    read: publishedOrStaff,
    create: canEditCatalog,
    update: canEditCatalog,
    delete: nobody,
    readVersions: isStaff,
    unlock: isStaff,
  },
  hooks: { afterChange: [revalidate.afterChange], afterDelete: [revalidate.afterDelete] },
  indexes: [{ fields: ['kind', 'slug'] }],
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    slugField('Latin lowercase, e.g. returns. The URL is /legal/{slug}/ for legal pages.'),
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'legal',
      options: PAGE_KINDS.map((k) => ({ label: k, value: k })),
      admin: { position: 'sidebar' },
    },
    {
      name: 'markets',
      type: 'select',
      hasMany: true,
      required: true,
      options: MARKET_CODES.map((c) => ({ label: c.toUpperCase(), value: c })),
      admin: { position: 'sidebar', description: 'Markets this page is published in.' },
    },
    {
      name: 'reviewedAt',
      type: 'date',
      admin: { position: 'sidebar', description: 'Last legal review; shown on the page.' },
    },
    { name: 'summary', type: 'textarea', localized: true },
    { name: 'body', type: 'richText', required: true, localized: true },
    seoField,
    arabicReviewField,
  ],
}
