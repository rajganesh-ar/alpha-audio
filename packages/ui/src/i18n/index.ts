import en from './en.json'
import ar from './ar.json'

/**
 * UI dictionary. `en.json` defines the keys; `ar.json` must have exactly the same shape, so a
 * missing Arabic string fails type-check (and therefore the build). Arabic is `draft` until
 * the native reviewer signs it off; nothing here is machine-translated for publication.
 */
export type Messages = Omit<typeof en, '$meta'>
export type DictionaryLocale = 'en' | 'ar'
export type DictionaryStatus = 'published' | 'draft'

export interface Dictionary {
  locale: DictionaryLocale
  status: DictionaryStatus
  messages: Messages
}

type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>
}[keyof T & string]

/** Every translatable key, such as `shell.nav.products`. A typo is a type error. */
export type MessageKey = Leaves<Messages>

function load(source: typeof en | typeof ar, locale: DictionaryLocale): Dictionary {
  const { $meta, ...messages } = source
  // `satisfies` makes ar.json prove it has every key en.json has.
  const typed = messages satisfies Messages
  return { locale, status: $meta.status as DictionaryStatus, messages: typed }
}

const DICTIONARIES: Record<DictionaryLocale, Dictionary> = {
  en: load(en, 'en'),
  ar: load(ar, 'ar'),
}

export function getDictionary(locale: DictionaryLocale): Dictionary {
  return DICTIONARIES[locale]
}

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string

/** Looks a key up and fills `{name}` placeholders. Numbers are written with Western digits. */
export function translator(dictionary: Dictionary): Translate {
  return (key, vars) => {
    let node: unknown = dictionary.messages
    for (const part of key.split('.')) node = (node as Record<string, unknown>)[part]
    if (typeof node !== 'string') throw new Error(`Missing ${dictionary.locale} string: ${key}`)
    return node.replace(/\{(\w+)\}/g, (whole, name: string) => {
      const value = vars?.[name]
      return value === undefined ? whole : String(value)
    })
  }
}
