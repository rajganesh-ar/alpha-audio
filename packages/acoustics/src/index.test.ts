import { describe, expect, it } from 'vitest'
import { PACKAGE } from './index'

describe('@alpha/acoustics', () => {
  it('exports its package name', () => {
    expect(PACKAGE).toBe('@alpha/acoustics')
  })
})
