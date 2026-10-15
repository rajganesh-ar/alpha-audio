import type { CollectionConfig } from 'payload'
import { canEditCatalog, isStaff, nobody, publishedOrStaff } from '../../access'
import { revalidateStorefront } from '../../hooks/revalidateStorefront'
import { arabicReviewField, slugField } from './fields'
import { FACET_SPECS } from './specs'

const revalidate = revalidateStorefront('catalog')

/** Nested by `parent` (Amplifiers → Integrated amplifiers). */
export const Categories: CollectionConfig = {
  slug: 'categories',
  labels: { singular: 'Category', plural: 'Categories' },
  admin: {
    group: 'Catalogue',
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'parent', 'order', '_status'],
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
  defaultSort: 'order',
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    slugField('Latin lowercase, e.g. integrated-amplifiers.'),
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'categories',
      admin: { position: 'sidebar' },
      filterOptions: ({ id }) => (id ? { id: { not_equals: id } } : true),
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 100,
      admin: { position: 'sidebar', description: 'Lower comes first.' },
    },
    { name: 'summary', type: 'textarea', localized: true },
    {
      name: 'facetSpecs',
      type: 'select',
      hasMany: true,
      options: FACET_SPECS.map((key) => ({ label: key, value: key })),
      admin: {
        position: 'sidebar',
        description: 'Spec fields offered as filters on this category’s listing.',
      },
    },
    arabicReviewField,
  ],
}
