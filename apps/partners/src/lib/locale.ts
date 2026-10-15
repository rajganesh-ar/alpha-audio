import { headers } from 'next/headers'
import { getDictionary, translator, type Translate } from '@alpha/ui'
import { currentPartner } from './session'

export type PartnerLocale = 'en' | 'ar'

/** Arabic when the browser asks for it before English (signed-out pages). */
export function preferredLocale(acceptLanguage: string | null): PartnerLocale {
  const tags = (acceptLanguage ?? '')
    .split(',')
    .map((part) => {
      const [tag = '', q] = part.trim().split(';q=')
      return { tag: tag.toLowerCase(), q: q === undefined ? 1 : Number(q) }
    })
    .filter((t) => t.tag && Number.isFinite(t.q) && t.q > 0)
    .sort((a, b) => b.q - a.q)
  const first = tags.find((t) => t.tag.startsWith('ar') || t.tag.startsWith('en'))
  return first?.tag.startsWith('ar') ? 'ar' : 'en'
}

/** The page's locale: the signed-in user's setting, else the browser's preference. */
export async function pageLocale(): Promise<PartnerLocale> {
  const partner = await currentPartner()
  if (partner) return partner.account.user.locale
  return preferredLocale((await headers()).get('accept-language'))
}

export const copy = (locale: PartnerLocale): Translate => translator(getDictionary(locale))

/** Locale for number and date formatting; digits stay Western in Arabic (CLAUDE.md, UI). */
export const formatLocale = (locale: PartnerLocale, market: string) =>
  `${locale}-${market.toUpperCase()}-u-nu-latn`
