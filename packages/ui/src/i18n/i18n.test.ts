import { describe, expect, it } from 'vitest'
import en from './en.json'
import ar from './ar.json'
import { getDictionary, translator } from './index'

function keys(node: unknown, prefix = ''): string[] {
  if (typeof node === 'string') return [prefix]
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    keys(v, prefix ? `${prefix}.${k}` : k),
  )
}

describe('i18n', () => {
  const strip = (source: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(source).filter(([k]) => k !== '$meta'))

  it('has the same keys in English and Arabic', () => {
    expect(keys(strip(ar)).sort()).toEqual(keys(strip(en)).sort())
  })

  it('keeps Arabic in draft for the native reviewer', () => {
    expect(getDictionary('ar').status).toBe('draft')
    expect(getDictionary('en').status).toBe('published')
  })

  it('has no empty strings', () => {
    for (const source of [en, ar]) {
      for (const key of keys(strip(source))) {
        const value = key
          .split('.')
          .reduce<unknown>((n, p) => (n as Record<string, unknown>)[p], source)
        expect(value, key).not.toBe('')
      }
    }
  })

  it('fills placeholders and leaves unknown ones visible', () => {
    const t = translator(getDictionary('en'))
    expect(t('footer.copyright', { year: 2026 })).toBe('© 2026 Alpha Audio')
    expect(t('home.title')).toBe('Alpha Audio {market}')
    expect(translator(getDictionary('ar'))('shell.nav.brands')).toBe('العلامات التجارية')
  })

  it('throws on a key that is not a string', () => {
    const t = translator(getDictionary('en'))
    // @ts-expect-error reason: proving the runtime guard for keys that bypass the type
    expect(() => t('shell.nav')).toThrow(/Missing en string: shell.nav/)
  })
})
