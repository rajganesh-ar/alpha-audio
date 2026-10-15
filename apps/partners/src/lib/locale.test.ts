import { describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('./session', () => ({ currentPartner: async () => null }))

const { preferredLocale } = await import('./locale')

describe('preferredLocale', () => {
  it('picks Arabic only when the browser prefers it to English', () => {
    expect(preferredLocale('ar-AE,ar;q=0.9,en;q=0.8')).toBe('ar')
    expect(preferredLocale('en-GB,en;q=0.9,ar;q=0.8')).toBe('en')
    expect(preferredLocale('fr-FR,ar;q=0.5')).toBe('ar')
    expect(preferredLocale('en;q=0.4,ar;q=0.6')).toBe('ar')
    expect(preferredLocale(null)).toBe('en')
    expect(preferredLocale('ar;q=0')).toBe('en')
  })
})
