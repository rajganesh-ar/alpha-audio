import { readFileSync } from 'node:fs'
import type { MessageKey, Translate } from '@alpha/ui'

/**
 * The storefront dictionaries for assertions: the tests find controls by the same labels the
 * shopper reads. Read from disk (Playwright's loader does not import JSON without attributes).
 */
export function copy(locale: 'en' | 'ar'): Translate {
  const url = new URL(`../../../packages/ui/src/i18n/${locale}.json`, import.meta.url)
  const messages = JSON.parse(readFileSync(url, 'utf8')) as Record<string, unknown>
  return (key: MessageKey, vars = {}) => {
    const value = key
      .split('.')
      .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], messages)
    if (typeof value !== 'string') throw new Error(`Missing message ${key}`)
    return value.replace(/\{(\w+)\}/g, (_, name: string) =>
      String((vars as Record<string, unknown>)[name] ?? `{${name}}`),
    )
  }
}
