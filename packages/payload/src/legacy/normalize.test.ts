import { describe, expect, it } from 'vitest'
import {
  normalizeLegacyPath,
  normalizeLegacyQuery,
  validateLegacyPath,
  validateLegacyTarget,
} from './normalize'

describe('normalizeLegacyQuery', () => {
  it.each([
    ['bid=13', 'bid=13'],
    ['?bid=13', 'bid=13'],
    ['BID=13', 'bid=13'],
    ['bid=13&utm_source=ig&utm_medium=social', 'bid=13'],
    ['fbclid=abc&catid=53&gclid=x', 'catid=53'],
    ['catid=53&bid=13', 'bid=13&catid=53'], // order does not matter
    ['bid= 13 ', 'bid=13'],
    ['', ''],
    ['utm_campaign=only', ''],
    ['q=a+b', 'q=a+b'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeLegacyQuery(input)).toBe(expected)
  })

  it('accepts URLSearchParams from a request URL', () => {
    const url = new URL('https://alphaaudios.com/brand?utm_source=x&BID=13')
    expect(normalizeLegacyQuery(url.searchParams)).toBe('bid=13')
  })
})

describe('normalizeLegacyPath', () => {
  it.each([
    ['/brand', '/brand'],
    ['/Brand/', '/brand'],
    ['/collection?catid=5', '/collection'],
    ['brand', '/brand'],
    ['/', '/'],
    ['//', '/'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeLegacyPath(input)).toBe(expected)
  })
})

describe('validators', () => {
  it('accepts only on-site targets (no open redirect)', () => {
    expect(validateLegacyTarget('/ae/en/brands/mcintosh')).toBe(true)
    expect(validateLegacyTarget('https://evil.example/')).toMatch(/path on this site/)
    expect(validateLegacyTarget('//evil.example/')).toMatch(/path on this site/)
    expect(validateLegacyTarget('/a b')).toMatch(/spaces/)
    expect(validateLegacyTarget('/a\\b')).toMatch(/backslashes/)
    expect(validateLegacyTarget('')).toMatch(/required/)
  })

  it('keeps the query out of the source path', () => {
    expect(validateLegacyPath('/brand')).toBe(true)
    expect(validateLegacyPath('/brand?bid=13')).toMatch(/Source query/)
    expect(validateLegacyPath('brand')).toMatch(/start with/)
  })
})
