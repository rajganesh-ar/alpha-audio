import { describe, expect, it } from 'vitest'
import * as core from './index'

describe('@alpha/core public API', () => {
  it('exports the money module', () => {
    for (const name of [
      'money',
      'formatMoney',
      'vatShare',
      'vatShareOf',
      'roundToDecimals',
      'divideRoundHalfUp',
      'toDecimalString',
    ]) {
      expect(typeof (core as Record<string, unknown>)[name], name).toBe('function')
    }
  })
})
