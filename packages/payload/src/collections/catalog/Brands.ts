import type { CollectionConfig } from 'payload'
import { PRICE_DISPLAYS } from '@alpha/core'
import { canEditCatalog, isStaff, nobody, publishedOrStaff } from '../../access'
import { revalidateStorefront } from '../../hooks/revalidateStorefront'
import { arabicReviewField, slugField } from './fields'

const revalidate = revalidateStorefront('catalog')

export const Brands: CollectionConfig = {
  slug: 'brands',
  labels: { singular: 'Brand', plural: 'Brands' },
  admin: {
    group: 'Catalogue',
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'priceDisplay', '_status'],
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
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: { description: 'As the brand writes it; not translated.' },
    },
    slugField('Latin lowercase, e.g. mcintosh.'),
    { name: 'logo', type: 'upload', relationTo: 'media' },
    {
      name: 'priceDisplay',
      type: 'select',
      required: true,
      defaultValue: 'show',
      options: PRICE_DISPLAYS.map((v) => ({
        label: v === 'show' ? 'Show prices' : 'Price on request',
        value: v,
      })),
      admin: { description: 'Brand policy; "on request" overrides every product of the brand.' },
    },
    { name: 'story', type: 'textarea', localized: true },
    arabicReviewField,
  ],
}
