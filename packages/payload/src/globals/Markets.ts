import type { GlobalConfig } from 'payload'
import { isStaff, publicRead } from '../access'
import { revalidateMarkets } from '../hooks/revalidateMarkets'
import {
  ADDRESS_SCHEMES,
  FULFILMENT_MODES,
  LOCALE_CODES,
  MARKET_CODES,
  MARKET_STATUSES,
  PAYMENT_RAILS,
} from '../markets/codes'
import { MARKETS_SLUG } from '../markets/read'
import {
  validateDecimals,
  validateLocales,
  validateTimezone,
  validateUniqueCodes,
  validateVatRate,
} from '../markets/validate'

const options = <T extends string>(values: readonly T[]) =>
  values.map((value) => ({ label: value, value }))

/**
 * Markets: one row per GCC market. A market is a record, not a code branch (spec: GCC market
 * layer). Currency, decimals, VAT, locales, payment rails, address scheme, fulfilment and
 * status are read from here by routing, pricing and checkout.
 */
export const Markets: GlobalConfig = {
  slug: MARKETS_SLUG,
  label: 'Markets',
  admin: { group: 'Settings', description: 'Currency, VAT, languages and rails per market.' },
  access: { read: publicRead, update: isStaff, readVersions: isStaff },
  versions: { max: 100 },
  hooks: { afterChange: [revalidateMarkets] },
  fields: [
    {
      name: 'markets',
      type: 'array',
      label: 'Markets',
      labels: { singular: 'Market', plural: 'Markets' },
      admin: { initCollapsed: true },
      validate: (rows) => validateUniqueCodes(rows),
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'code',
              type: 'select',
              required: true,
              options: options(MARKET_CODES),
              admin: { width: '20%' },
            },
            {
              name: 'name',
              type: 'text',
              required: true,
              localized: true,
              admin: { width: '50%' },
            },
            {
              name: 'status',
              type: 'select',
              required: true,
              defaultValue: 'soon',
              options: options(MARKET_STATUSES),
              admin: { width: '30%', description: 'Only live markets are routable.' },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'currency',
              type: 'select',
              required: true,
              options: options(['AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR'] as const),
              admin: { width: '25%' },
            },
            {
              name: 'decimals',
              type: 'number',
              required: true,
              min: 0,
              max: 3,
              admin: { width: '25%', description: 'Must match the currency (ISO 4217).' },
              validate: (value: unknown, { siblingData }: { siblingData: unknown }) =>
                validateDecimals(value, (siblingData as { currency?: unknown }).currency),
            },
            {
              name: 'vatRate',
              type: 'number',
              required: true,
              min: 0,
              max: 100,
              admin: { width: '25%', step: 0.01, description: 'Percent, e.g. 5 or 15.' },
              validate: (value: unknown) => validateVatRate(value),
            },
            {
              name: 'timezone',
              type: 'text',
              required: true,
              admin: { width: '25%', placeholder: 'Asia/Dubai' },
              validate: (value: unknown) => validateTimezone(value),
            },
          ],
        },
        {
          name: 'locales',
          // Payload stores localized fields in `<table>_locales`, and a hasMany select named
          // `locales` would get the same table name, so the market's language list would have
          // no table of its own. An explicit dbName keeps the two apart, and an explicit
          // enumName stops the Postgres enum type taking the table's name (a table and a type
          // cannot share a name, and the table is then silently left out of the migration).
          dbName: 'markets_markets_enabled_locales',
          enumName: 'enum_markets_markets_enabled_locales',
          type: 'select',
          hasMany: true,
          required: true,
          options: options(LOCALE_CODES),
          validate: (value: unknown) => validateLocales(value),
        },
        {
          name: 'payments',
          type: 'select',
          hasMany: true,
          required: true,
          options: options(PAYMENT_RAILS),
        },
        {
          type: 'row',
          fields: [
            {
              name: 'addressScheme',
              type: 'select',
              required: true,
              options: options(ADDRESS_SCHEMES),
              admin: { width: '50%' },
            },
            {
              name: 'fulfilment',
              type: 'select',
              required: true,
              options: options(FULFILMENT_MODES),
              admin: { width: '50%', description: 'Who fulfils orders by default.' },
            },
          ],
        },
      ],
    },
  ],
}
