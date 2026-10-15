import { describe, expect, it } from 'vitest'
import {
  agreementProblems,
  brandsWithRights,
  isLive,
  liveAgreement,
  overlaps,
  type Agreement,
} from './rights'

const d = (iso: string) => new Date(`${iso}T00:00:00Z`)
const now = d('2026-10-15')
const a = (patch: Partial<Agreement> = {}): Agreement => ({
  brand: 1,
  market: 'ae',
  role: 'distributor',
  exclusive: true,
  validFrom: d('2026-01-01'),
  validTo: null,
  leadRouting: 'alpha',
  complianceFlags: [],
  ...patch,
})

describe('isLive', () => {
  it('needs a selling role, the validity window and no blocking flag', () => {
    expect(isLive(a(), now)).toBe(true)
    expect(isLive(a({ role: 'none' }), now)).toBe(false)
    expect(isLive(a({ validFrom: d('2026-10-16') }), now)).toBe(false)
    expect(isLive(a({ validTo: d('2026-10-15') }), now)).toBe(false) // validTo is exclusive
    expect(isLive(a({ validFrom: d('2026-10-15') }), now)).toBe(true) // validFrom inclusive
    expect(isLive(a({ validFrom: null, validTo: d('2027-01-01') }), now)).toBe(true)
    expect(isLive(a({ complianceFlags: ['origin-restriction'] }), now)).toBe(false)
    expect(isLive(a({ complianceFlags: ['registration-pending'] }), now)).toBe(false)
    expect(
      isLive(a({ complianceFlags: ['arabic-labelling', 'wireless-type-approval'] }), now),
    ).toBe(true)
  })
})

describe('liveAgreement', () => {
  it('picks the live agreement for the brand and market, distributor and exclusive first', () => {
    const retailer = a({ id: 'r', role: 'retailer', exclusive: false })
    const distributor = a({ id: 'd', role: 'distributor', exclusive: false })
    expect(liveAgreement([retailer, distributor], 1, 'ae', now)?.id).toBe('d')
    expect(
      liveAgreement([retailer, a({ id: 'x', role: 'retailer', exclusive: true })], '1', 'ae', now)
        ?.id,
    ).toBe('x')
    expect(liveAgreement([retailer], 1, 'sa', now)).toBeNull()
    expect(liveAgreement([retailer], 2, 'ae', now)).toBeNull()
    expect(liveAgreement([a({ validTo: d('2026-06-01') })], 1, 'ae', now)).toBeNull()
  })

  it('lists brands with rights in a market', () => {
    expect([
      ...brandsWithRights(
        [a(), a({ brand: 2, role: 'none' }), a({ brand: 3, market: 'sa' }), a({ brand: 4 })],
        'ae',
        now,
      ),
    ]).toEqual(['1', '4'])
  })
})

describe('overlaps and validation', () => {
  it('detects shared instants, with exclusive ends', () => {
    expect(overlaps(a({ validTo: d('2026-06-01') }), a({ validFrom: d('2026-06-01') }))).toBe(false)
    expect(overlaps(a({ validTo: d('2026-06-02') }), a({ validFrom: d('2026-06-01') }))).toBe(true)
    expect(overlaps(a({ validFrom: null }), a({ validFrom: d('2030-01-01') }))).toBe(true)
    expect(overlaps(a(), a({ market: 'sa' }))).toBe(false)
    expect(overlaps(a(), a({ brand: 2 }))).toBe(false)
    expect(
      overlaps(
        a({ validFrom: d('2026-01-01'), validTo: d('2026-03-01') }),
        a({ validFrom: null, validTo: d('2026-01-01') }),
      ),
    ).toBe(false)
  })

  it('reports an end before the start, and overlaps with other agreements only', () => {
    expect(
      agreementProblems(a({ validFrom: d('2026-05-01'), validTo: d('2026-05-01') }), []),
    ).toEqual(['ends-before-start'])
    const existing = [a({ id: 7, validTo: d('2026-12-31') })]
    expect(agreementProblems(a({ validFrom: d('2026-12-01') }), existing)).toEqual(['overlaps'])
    expect(agreementProblems(a({ id: 7, validFrom: d('2026-02-01') }), existing)).toEqual([])
    expect(agreementProblems(a({ validFrom: d('2026-12-31') }), existing)).toEqual([])
  })
})
