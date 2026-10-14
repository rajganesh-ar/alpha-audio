import type { CollectionConfig, Field } from 'payload'
import { PRICE_DISPLAYS } from '@alpha/core'
import { canEditCatalog, canReadCost, isStaff, nobody, publishedOrStaff } from '../../access'
import { revalidateStorefront } from '../../hooks/revalidateStorefront'
import { MARKET_CODES } from '../../markets/codes'
import { wholeNumber } from '../purchasing/fields'
import { arabicReviewField, seoField, slugField } from './fields'

const revalidate = revalidateStorefront('catalog')

const positive = (label: string) => (value: unknown) =>
  value === undefined ||
  value === null ||
  (typeof value === 'number' && Number.isFinite(value) && value > 0)
    ? true
    : `${label} must be above zero.`

const spec = (name: string, label: string, description?: string): Field => ({
  name,
  label,
  type: 'number',
  admin: { width: '25%', ...(description ? { description } : {}) },
  validate: positive(label),
})

const uniqueMarkets = (value: unknown) => {
  if (!Array.isArray(value)) return true
  const codes = value.map((row: { market?: unknown }) => row.market)
  const duplicate = codes.find((code, i) => codes.indexOf(code) !== i)
  return duplicate ? `${String(duplicate)} is listed twice; keep one row per market.` : true
}

/** Lifecycle, separate from draft/published (`_status`, whose enum name a `status` field would collide with). */
export const PRODUCT_LIFECYCLES = ['active', 'discontinued'] as const

/**
 * A sellable model. Stock is never a field (CLAUDE.md rule 1): it comes from the ledger by SKU.
 * Prices are per market, VAT inclusive, in the market currency's minor units; `cost` is
 * staff-only and never leaves the admin.
 */
export const Products: CollectionConfig = {
  slug: 'products',
  labels: { singular: 'Product', plural: 'Products' },
  admin: {
    group: 'Catalogue',
    useAsTitle: 'title',
    defaultColumns: ['title', 'sku', 'brand', 'lifecycle', '_status'],
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
    { name: 'title', type: 'text', required: true, localized: true },
    slugField('{brand}-{model} in Latin lowercase, e.g. mcintosh-ma352. Same in every locale.'),
    {
      type: 'row',
      fields: [
        {
          name: 'brand',
          type: 'relationship',
          relationTo: 'brands',
          required: true,
          admin: { width: '40%' },
        },
        {
          name: 'sku',
          type: 'text',
          required: true,
          unique: true,
          index: true,
          admin: { width: '30%', description: 'Ledger key, e.g. MCINTOSH-MA352.' },
          validate: (value: unknown) =>
            typeof value === 'string' && /^[A-Z0-9][A-Z0-9-]*$/.test(value)
              ? true
              : 'Use uppercase letters, digits and hyphens.',
        },
        {
          name: 'lifecycle',
          type: 'select',
          required: true,
          defaultValue: 'active',
          options: PRODUCT_LIFECYCLES.map((s) => ({ label: s, value: s })),
          admin: { width: '30%' },
        },
      ],
    },
    { name: 'categories', type: 'relationship', relationTo: 'categories', hasMany: true },
    {
      name: 'summary',
      type: 'textarea',
      localized: true,
      admin: { description: 'One or two sentences for cards and the product page.' },
    },
    {
      name: 'gallery',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      admin: {
        description:
          'The first image is the card and page lead image. Alt text lives on each image, in both languages.',
      },
    },
    {
      name: 'specs',
      type: 'group',
      admin: {
        description:
          'Structured, so the Builder and filters can use them. Empty values are hidden.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            spec('powerW', 'Power (W per channel)'),
            spec('channels', 'Channels'),
            spec('impedanceOhm', 'Nominal impedance (Ω)'),
            spec('minImpedanceOhm', 'Minimum impedance (Ω)'),
          ],
        },
        {
          type: 'row',
          fields: [
            spec('sensitivityDb', 'Sensitivity (dB)', '2.83 V / 1 m'),
            spec('frequencyLowHz', 'Frequency response from (Hz)'),
            spec('frequencyHighHz', 'Frequency response to (Hz)'),
            spec('weightKg', 'Weight (kg)'),
          ],
        },
        {
          name: 'dimensionsMm',
          type: 'group',
          label: 'Dimensions (mm)',
          fields: [
            {
              type: 'row',
              fields: [spec('width', 'Width'), spec('height', 'Height'), spec('depth', 'Depth')],
            },
          ],
        },
        {
          name: 'inputs',
          type: 'text',
          localized: true,
          admin: { description: 'e.g. 2 × XLR, 4 × RCA, phono MM/MC' },
        },
      ],
    },
    {
      name: 'markets',
      type: 'array',
      admin: {
        description:
          'One row per market the product is sold in. Not listed or not published means not sold there (the page 404s).',
      },
      validate: uniqueMarkets,
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'market',
              type: 'select',
              required: true,
              options: MARKET_CODES.map((c) => ({ label: c.toUpperCase(), value: c })),
              admin: { width: '20%' },
            },
            { name: 'published', type: 'checkbox', defaultValue: false, admin: { width: '15%' } },
            {
              name: 'rrpInclVat',
              label: 'RRP incl. VAT',
              type: 'number',
              admin: {
                width: '35%',
                description: 'Minor units of the market currency (fils, halalas…).',
              },
              validate: wholeNumber('RRP', 1),
            },
            {
              name: 'priceDisplay',
              type: 'select',
              defaultValue: 'show',
              options: PRICE_DISPLAYS.map((v) => ({
                label: v === 'show' ? 'Show price' : 'On request',
                value: v,
              })),
              admin: { width: '30%' },
            },
          ],
        },
      ],
    },
    {
      name: 'cost',
      type: 'number',
      access: { read: canReadCost, create: canReadCost, update: canReadCost },
      admin: {
        position: 'sidebar',
        description: 'Landed unit cost, AED fils. Staff only; never shown on the storefront.',
      },
      validate: wholeNumber('Cost', 0),
    },
    seoField,
    arabicReviewField,
  ],
}
