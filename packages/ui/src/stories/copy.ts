import { getDictionary, translator, type Translate } from '../i18n'

/** Story copy comes from the dictionaries, so RTL stories show the real (draft) Arabic. */
export const en: Translate = translator(getDictionary('en'))
export const ar: Translate = translator(getDictionary('ar'))

/** Parameters that render a story in Arabic, right to left. */
export const RTL = { direction: 'rtl' } as const
