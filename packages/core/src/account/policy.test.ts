import { describe, expect, it } from 'vitest'
import { linkState, normaliseEmail, signInLimit } from './policy'

describe('sign-in policy', () => {
  it('normalises addresses and refuses what cannot be one', () => {
    expect(normaliseEmail('  Layla@Example.COM ')).toBe('layla@example.com')
    for (const bad of ['', 'layla', 'a@b', 'a b@c.d', 42, null, `${'x'.repeat(250)}@a.ae`])
      expect(normaliseEmail(bad)).toBeNull()
  })

  it('limits requests per address and per network', () => {
    expect(signInLimit({ forEmail: 4, forIp: 19 })).toBe('ok')
    expect(signInLimit({ forEmail: 5, forIp: 0 })).toBe('email-limit')
    expect(signInLimit({ forEmail: 0, forIp: 20 })).toBe('ip-limit')
  })

  it('accepts a link once and only before it expires', () => {
    const now = new Date('2026-10-15T10:00:00Z')
    const later = new Date('2026-10-15T10:10:00Z')
    expect(linkState(null, now)).toBe('unknown')
    expect(linkState({ expiresAt: later, usedAt: null }, now)).toBe('valid')
    expect(linkState({ expiresAt: later, usedAt: now }, now)).toBe('used')
    expect(linkState({ expiresAt: now, usedAt: null }, now)).toBe('expired')
  })
})
