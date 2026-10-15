import { describe, expect, it } from 'vitest'
import { toMinor } from './opsProjects'

describe('toMinor', () => {
  it('reads plain amounts in the currency’s decimals', () => {
    expect(toMinor('3500', 2)).toBe(350_000n)
    expect(toMinor('3,500.5', 2)).toBe(350_050n)
    expect(toMinor('12.345', 3)).toBe(12_345n)
    expect(toMinor(' ', 2)).toBeNull()
    expect(toMinor('1.234', 2)).toBeNull()
    expect(toMinor('-1', 2)).toBeNull()
    expect(toMinor('1e5', 2)).toBeNull()
  })
})
