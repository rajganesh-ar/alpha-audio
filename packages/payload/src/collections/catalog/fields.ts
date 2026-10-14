import type { Field } from 'payload'

/** Latin, lowercase, hyphenated; identical in every locale (spec: routing rules). */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const slugField = (
  description = 'Latin lowercase and hyphens, e.g. mcintosh-ma352. Same in every locale.',
): Field => ({
  name: 'slug',
  type: 'text',
  required: true,
  unique: true,
  index: true,
  admin: { position: 'sidebar', description },
  validate: (value: unknown) =>
    typeof value === 'string' && SLUG_PATTERN.test(value)
      ? true
      : 'Use lowercase Latin letters, digits and single hyphens.',
})

/**
 * Arabic copy written by anyone other than the native reviewer (a seed, a draft by staff) is
 * `draft` until the reviewer marks it `reviewed` (CLAUDE.md: Arabic is never machine-published).
 */
export const arabicReviewField: Field = {
  name: 'arabicReview',
  type: 'select',
  required: true,
  defaultValue: 'draft',
  options: [
    { label: 'Draft (needs native review)', value: 'draft' },
    { label: 'Reviewed', value: 'reviewed' },
  ],
  admin: {
    position: 'sidebar',
    description: 'Arabic copy is published only after the native reviewer signs it off.',
  },
}

export const seoField: Field = {
  name: 'seo',
  type: 'group',
  fields: [
    {
      name: 'title',
      type: 'text',
      localized: true,
      admin: { description: 'Defaults to the title.' },
    },
    { name: 'description', type: 'textarea', localized: true, maxLength: 300 },
  ],
}

/** A path inside the current market and locale, e.g. `/design/advisor`. */
export const marketPathField = (name: string, label?: string): Field => ({
  name,
  type: 'text',
  ...(label ? { label } : {}),
  admin: {
    description: 'Path inside the market, e.g. /design/advisor. The market and language are added.',
  },
  validate: (value: unknown) =>
    value === undefined ||
    value === null ||
    value === '' ||
    (typeof value === 'string' && /^\/[a-z0-9/-]*$/.test(value))
      ? true
      : 'Start with / and use lowercase letters, digits, hyphens and slashes.',
})
