import type { Field, GlobalConfig } from 'payload'
import { isStaff } from '../access'

const bps = (name: string, label: string, description: string): Field => ({
  name,
  label,
  type: 'number',
  required: true,
  admin: { description: `${description} Basis points: 100 = 1%.` },
  validate: (v: unknown) =>
    typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 10_000
      ? true
      : `${label} is basis points from 0 to 10000.`,
})

/**
 * Inputs to the dealer price engine that are not per company (docs/tasks/0013): channel factors
 * on RRP excl. VAT, the target margin for products without an RRP, the margin floor below which
 * a price needs approval, and FX rates to AED for the floor. Staff only.
 */
export const PricingSettings: GlobalConfig = {
  slug: 'pricing-settings',
  label: 'Pricing settings',
  admin: { group: 'Trade' },
  access: { read: isStaff, update: isStaff },
  fields: [
    {
      name: 'channelFactors',
      type: 'group',
      fields: [
        {
          type: 'row',
          fields: [
            { ...bps('dealer', 'Dealer', 'Share of RRP excl. VAT.'), defaultValue: 7_000 } as Field,
            {
              ...bps('integrator', 'Integrator', 'Share of RRP excl. VAT.'),
              defaultValue: 7_500,
            } as Field,
            {
              ...bps('retailer', 'Retailer', 'Share of RRP excl. VAT.'),
              defaultValue: 8_000,
            } as Field,
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          ...bps('targetMargin', 'Target margin', 'Over landed cost, for products without an RRP.'),
          defaultValue: 2_500,
        } as Field,
        {
          ...bps(
            'marginFloor',
            'Margin floor',
            'Below landed cost ÷ (1 − floor) a price needs approval.',
          ),
          defaultValue: 1_000,
        } as Field,
      ],
    },
    {
      name: 'quoteValidityDays',
      label: 'Quote validity (days)',
      type: 'number',
      required: true,
      defaultValue: 7,
      admin: {
        description: 'Dealer quotes keep their prices and hold stock this long (docs/tasks/0016).',
      },
      validate: (v: unknown) =>
        typeof v === 'number' && Number.isSafeInteger(v) && v >= 1 && v <= 30
          ? true
          : 'Quote validity is a whole number of days from 1 to 30.',
    },
    {
      name: 'fxRates',
      label: 'FX rates to AED',
      type: 'array',
      admin: {
        description:
          'AED for one unit of each currency, e.g. SAR 0.979, KWD 11.95. Used for the margin floor.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'currency',
              type: 'select',
              required: true,
              options: ['SAR', 'QAR', 'KWD', 'BHD', 'OMR'].map((c) => ({ label: c, value: c })),
              admin: { width: '50%' },
            },
            {
              name: 'aedPerUnit',
              type: 'text',
              required: true,
              admin: { width: '50%' },
              validate: (v: unknown) =>
                typeof v === 'string' && /^\d{1,4}(\.\d{1,6})?$/.test(v) && Number(v) > 0
                  ? true
                  : 'A positive decimal with up to six places, e.g. 0.979.',
            },
          ],
        },
      ],
    },
  ],
}
