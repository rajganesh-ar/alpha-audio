import type { Payload } from 'payload'
import type { MarketRecord } from '../markets/types'
import { loadMarkets, MARKETS_SLUG } from '../markets/read'

/**
 * Seed values for the six GCC markets (spec: GCC market layer). UAE launches first (phase P2),
 * so it is the only market seeded as `live`; the rest are `soon` until their phase. Status is
 * data: staff switch a market live in the admin, no deploy needed.
 *
 * Arabic names are standard country names but still need the native reviewer's sign-off
 * before launch (CLAUDE.md: Arabic copy is never published from machine output unreviewed).
 */
export const MARKETS_SEED: readonly MarketRecord[] = [
  {
    code: 'ae',
    name: { en: 'United Arab Emirates', ar: 'الإمارات العربية المتحدة' },
    currency: 'AED',
    decimals: 2,
    vatRate: 5,
    locales: ['en', 'ar'],
    payments: ['card', 'applepay', 'googlepay', 'tabby', 'tamara', 'cod'],
    addressScheme: 'ae-makani',
    fulfilment: 'alpha',
    status: 'live',
    timezone: 'Asia/Dubai',
  },
  {
    code: 'sa',
    name: { en: 'Saudi Arabia', ar: 'المملكة العربية السعودية' },
    currency: 'SAR',
    decimals: 2,
    vatRate: 15,
    locales: ['en', 'ar'],
    payments: ['mada', 'card', 'applepay', 'tabby', 'tamara'],
    addressScheme: 'sa-national-address',
    fulfilment: 'dealer',
    status: 'soon',
    timezone: 'Asia/Riyadh',
  },
  {
    code: 'qa',
    name: { en: 'Qatar', ar: 'قطر' },
    currency: 'QAR',
    decimals: 2,
    vatRate: 0,
    locales: ['en', 'ar'],
    payments: ['naps', 'card', 'applepay'],
    addressScheme: 'qa-zone',
    fulfilment: 'dealer',
    status: 'soon',
    timezone: 'Asia/Qatar',
  },
  {
    code: 'kw',
    name: { en: 'Kuwait', ar: 'الكويت' },
    currency: 'KWD',
    decimals: 3,
    vatRate: 0,
    locales: ['en', 'ar'],
    payments: ['knet', 'card'],
    addressScheme: 'kw-paci',
    fulfilment: 'dealer',
    status: 'soon',
    timezone: 'Asia/Kuwait',
  },
  {
    code: 'bh',
    name: { en: 'Bahrain', ar: 'البحرين' },
    currency: 'BHD',
    decimals: 3,
    vatRate: 10,
    locales: ['en', 'ar'],
    payments: ['benefitpay', 'card'],
    addressScheme: 'bh-block',
    fulfilment: 'dealer',
    status: 'soon',
    timezone: 'Asia/Bahrain',
  },
  {
    code: 'om',
    name: { en: 'Oman', ar: 'عُمان' },
    currency: 'OMR',
    decimals: 3,
    vatRate: 5,
    locales: ['en', 'ar'],
    payments: ['omannet', 'card'],
    addressScheme: 'om-way',
    fulfilment: 'dealer',
    status: 'soon',
    timezone: 'Asia/Muscat',
  },
]

export interface SeedMarketsResult {
  added: string[]
  kept: string[]
}

/**
 * Adds any seed market that is not in the Markets global yet and leaves existing rows alone,
 * so re-running never overwrites a status, VAT rate or rail that staff changed in the admin.
 */
export async function seedMarkets(payload: Payload): Promise<SeedMarketsResult> {
  const existing = await loadMarkets(payload)
  const existingCodes = new Set(existing.map((m) => m.code))
  const toAdd = MARKETS_SEED.filter((m) => !existingCodes.has(m.code))
  if (toAdd.length === 0) return { added: [], kept: [...existingCodes] }

  // Localized `name` is written per locale: the English write creates the rows, the Arabic
  // write fills the same rows' Arabic names (Payload keeps row ids across locales).
  const merged = [...existing, ...toAdd]
  const context = { disableRevalidate: true }
  const written = (await payload.updateGlobal({
    slug: MARKETS_SLUG,
    locale: 'en',
    data: { markets: merged.map((m) => ({ ...m, name: m.name.en })) },
    context,
    // System seed: runs from a script with no signed-in user, before any staff account exists.
    overrideAccess: true,
  })) as { markets?: Array<{ id?: string }> }

  const ids = (written.markets ?? []).map((row) => row.id)
  if (ids.length !== merged.length || ids.some((id) => !id)) {
    throw new Error('Markets seed: the English write did not return a row id for every market.')
  }
  await payload.updateGlobal({
    slug: MARKETS_SLUG,
    locale: 'ar',
    data: { markets: merged.map((m, i) => ({ ...m, id: ids[i] ?? null, name: m.name.ar })) },
    context,
    // System seed: as above.
    overrideAccess: true,
  })

  return { added: toAdd.map((m) => m.code), kept: [...existingCodes] }
}
