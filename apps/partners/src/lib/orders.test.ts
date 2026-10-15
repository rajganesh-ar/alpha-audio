import { describe, expect, it } from 'vitest'
import { money } from '@alpha/core'
import { getDictionary, translator } from '@alpha/ui'
import { creditRatio, draftLines, problemText, reviewQuery, storedMoney } from './orders'

const t = translator(getDictionary('en'))
const aed = (n: bigint) => money(n, 'AED', 2)

describe('order helpers', () => {
  it('pairs SKUs with quantities, skipping blank rows and refusing bad quantities', () => {
    expect(draftLines(['A', ' ', 'B', 'C', 'D'], ['2', '9', '', 'x', '-1'])).toEqual([
      { sku: 'A', qty: 2 },
      { sku: 'B', qty: 1 },
      { sku: 'C', qty: 0 },
      { sku: 'D', qty: 0 },
    ])
    expect(
      draftLines(
        Array.from({ length: 300 }, (_, i) => `S${i}`),
        [],
      ),
    ).toHaveLength(200)
  })

  it('round-trips lines through the review URL', () => {
    expect(reviewQuery([{ sku: 'A B', qty: 2 }], { status: 'rules' })).toBe(
      'sku=A+B&qty=2&status=rules',
    )
  })

  it('words problems per line and for the order', () => {
    const text = problemText(
      {
        lines: [
          { sku: 'A', problem: 'multiple', multiple: 2 },
          { sku: 'B', problem: 'unavailable' },
        ],
        order: [
          { problem: 'minimum-value', minimum: aed(500_000n) },
          { problem: 'too-many-lines', max: 200 },
          { problem: 'empty' },
        ],
      },
      t,
      'en-AE-u-nu-latn',
    )
    expect(text.lines.get('A')).toBe('Order in multiples of 2.')
    expect(text.lines.get('B')).toBe('Not available to your company.')
    expect(text.order.map((s) => s.replace(/\u00a0/g, ' '))).toEqual([
      'Your minimum order is AED 5,000.00 before VAT.',
      'An order can have at most 200 lines.',
      'Add at least one product.',
    ])
  })

  it('reads stored money and the credit ratio', () => {
    expect(storedMoney(1234, { currency: 'KWD', decimals: 3 })).toEqual(money(1234n, 'KWD', 3))
    expect(storedMoney(null, { currency: 'AED', decimals: 2 })).toBeNull()
    expect(creditRatio({ limit: aed(5_000_000n), used: aed(2_898_000n) })).toBe(0.5796)
    expect(creditRatio({ limit: aed(0n), used: aed(1n) })).toBe(1)
    expect(creditRatio({ limit: aed(0n), used: aed(0n) })).toBe(0)
    expect(creditRatio({ limit: null, used: aed(1n) })).toBeNull()
    expect(creditRatio(null)).toBeNull()
  })
})
