import { describe, expect, it } from 'vitest'
import { ReceivingError } from './errors'
import { assertManualPoStatusChange, linesEditable } from './rules'

describe('manual purchase order status changes', () => {
  it.each([
    ['draft', 'ordered', false],
    ['draft', 'cancelled', false],
    ['ordered', 'cancelled', false],
    ['ordered', 'closed', false],
    ['partially_received', 'closed', true],
    ['received', 'closed', true],
    ['ordered', 'ordered', false],
  ] as const)('allows %s → %s', (from, to, received) => {
    expect(() => assertManualPoStatusChange(from, to, received)).not.toThrow()
  })

  it.each([
    ['draft', 'received', false],
    ['ordered', 'partially_received', false],
    ['closed', 'ordered', false],
    ['cancelled', 'ordered', false],
    ['partially_received', 'cancelled', true],
    ['ordered', 'cancelled', true],
  ] as const)('refuses %s → %s', (from, to, received) => {
    expect(() => assertManualPoStatusChange(from, to, received)).toThrow(ReceivingError)
  })

  it('lets lines change only in draft', () => {
    expect(linesEditable('draft')).toBe(true)
    expect(linesEditable('ordered')).toBe(false)
  })
})
