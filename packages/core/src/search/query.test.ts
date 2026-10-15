import { describe, expect, it } from 'vitest'
import { normaliseSearchText, pageOf, parseSearchQuery } from './query'

describe('search query', () => {
  it('requires every word and prefixes the last', () => {
    expect(parseSearchQuery('  McIntosh   AMP ')).toEqual({
      text: 'McIntosh AMP',
      tokens: ['mcintosh', 'amp'],
      tsquery: 'mcintosh & amp:*',
      fuzzy: 'mcintosh amp',
    })
    expect(parseSearchQuery('MA352').tsquery).toBe('ma352:*')
  })

  it('drops tsquery operators and punctuation, so input can never inject syntax', () => {
    expect(parseSearchQuery("ma352 & !(x) | 'y':* <-> z").tokens).toEqual(['ma352', 'x', 'y', 'z'])
    expect(parseSearchQuery('!!! ***').tsquery).toBeNull()
    expect(parseSearchQuery(undefined)).toEqual({ text: '', tokens: [], tsquery: null, fuzzy: '' })
    expect(parseSearchQuery(['a'])).toMatchObject({ tsquery: null })
  })

  it('caps the length and the number of words', () => {
    expect(parseSearchQuery('x'.repeat(500)).text).toHaveLength(100)
    expect(parseSearchQuery('a b c d e f g h i j').tokens).toHaveLength(8)
  })

  it('normalises Arabic as the index does', () => {
    expect(normaliseSearchText('مُضَخِّم')).toBe('مضخم')
    expect(normaliseSearchText('أإآٱ')).toBe('اااا')
    expect(normaliseSearchText('مكبّرة صوت')).toBe('مكبره صوت')
    expect(normaliseSearchText('مستشفى')).toBe('مستشفي')
    expect(normaliseSearchText('٣٥٢ ـــ ۴')).toBe('352  4')
    expect(parseSearchQuery('مُضَخِّم متكامل').tsquery).toBe('مضخم & متكامل:*')
  })

  it('pages results and clamps the page', () => {
    const ids = Array.from({ length: 50 }, (_, i) => i)
    expect(pageOf(ids, 2)).toMatchObject({ page: 2, pages: 3, total: 50, items: ids.slice(24, 48) })
    expect(pageOf(ids, 9).page).toBe(3)
    expect(pageOf(ids, Number.NaN).page).toBe(1)
    expect(pageOf([], 1)).toEqual({ items: [], page: 1, pages: 1, total: 0 })
  })
})
