import type { GlobalConfig } from 'payload'
import { canEditCatalog, publicRead } from '../access'
import { revalidateStorefrontGlobal } from '../hooks/revalidateStorefront'
import { arabicReviewField, marketPathField, seoField } from '../collections/catalog/fields'

export const ENTRY_TOOLS = ['advisor', 'room-lab', 'builder'] as const
export type EntryTool = (typeof ENTRY_TOOLS)[number]

/** The storefront home page (spec: Page specifications → Home). Same layout in every market. */
export const Home: GlobalConfig = {
  slug: 'home',
  label: 'Home page',
  admin: { group: 'Content' },
  versions: { drafts: true },
  access: { read: publicRead, update: canEditCatalog, readVersions: canEditCatalog },
  hooks: { afterChange: [revalidateStorefrontGlobal('home')] },
  fields: [
    {
      name: 'hero',
      type: 'group',
      fields: [
        {
          name: 'poster',
          type: 'upload',
          relationTo: 'media',
          admin: { description: 'Paints first; at most 200 KB.' },
        },
        { name: 'eyebrow', type: 'text', localized: true },
        { name: 'headline', type: 'text', required: true, localized: true },
        { name: 'lede', type: 'textarea', localized: true },
        {
          type: 'row',
          fields: [
            { name: 'ctaLabel', type: 'text', localized: true },
            marketPathField('ctaHref', 'CTA link'),
          ],
        },
      ],
    },
    {
      name: 'entryCards',
      type: 'array',
      maxRows: 3,
      admin: { description: 'Advisor, Room Lab and Builder.' },
      fields: [
        {
          name: 'tool',
          type: 'select',
          required: true,
          options: ENTRY_TOOLS.map((t) => ({ label: t, value: t })),
        },
        { name: 'title', type: 'text', required: true, localized: true },
        { name: 'body', type: 'textarea', localized: true },
        { name: 'ctaLabel', type: 'text', localized: true },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'featuredTitle', type: 'text', localized: true },
        { name: 'categoriesTitle', type: 'text', localized: true },
      ],
    },
    {
      name: 'featured',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
      maxRows: 8,
      admin: {
        description:
          'Shown where they are published in the market. When none are, the top categories show instead.',
      },
    },
    {
      name: 'topCategories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      maxRows: 6,
    },
    seoField,
    arabicReviewField,
  ],
}
