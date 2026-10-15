import { describe, expect, it } from 'vitest'
import { money } from '../money'
import { approvalsFor, checkOrderRules, creditPosition, rulesPass } from './rules'

const aed = (n: bigint) => money(n, 'AED', 2)

describe('checkOrderRules', () => {
  const rules = { orderMultiple: 2, minOrderValue: 500_000n }

  it('passes an order that keeps the rules', () => {
    const check = checkOrderRules([{ sku: 'A', qty: 4, status: 'ok' }], aed(600_000n), rules)
    expect(check).toEqual({ lines: [], order: [] })
    expect(rulesPass(check)).toBe(true)
  })

  it('names each line problem and the order problems', () => {
    const check = checkOrderRules(
      [
        { sku: 'A', qty: 3, status: 'ok' },
        { sku: 'B', qty: 2, status: 'unavailable' },
        { sku: 'C', qty: 0, status: 'ok' },
        { sku: 'D', qty: 2, status: 'needs-approval' },
      ],
      aed(400_000n),
      rules,
    )
    expect(check.lines).toEqual([
      { sku: 'A', problem: 'multiple', multiple: 2 },
      { sku: 'B', problem: 'unavailable' },
      { sku: 'C', problem: 'invalid-quantity' },
    ])
    expect(check.order).toEqual([{ problem: 'minimum-value', minimum: aed(500_000n) }])
    expect(rulesPass(check)).toBe(false)
  })

  it('refuses an empty or oversized order and ignores unset rules', () => {
    expect(checkOrderRules([], aed(0n), rules).order).toEqual([{ problem: 'empty' }])
    const many = Array.from({ length: 201 }, (_, i) => ({
      sku: `S${i}`,
      qty: 1,
      status: 'ok' as const,
    }))
    expect(
      checkOrderRules(many, aed(1n), { orderMultiple: null, minOrderValue: null }).order,
    ).toEqual([{ problem: 'too-many-lines', max: 200 }])
    expect(
      checkOrderRules([{ sku: 'A', qty: 1.5, status: 'ok' }], aed(1n), {
        orderMultiple: 1,
        minOrderValue: null,
      }).lines,
    ).toEqual([{ sku: 'A', problem: 'invalid-quantity' }])
  })
})

describe('approvalsFor', () => {
  const base = {
    placer: { role: 'owner', approvalThreshold: null },
    lines: [{ status: 'ok' as const }],
    totals: { net: aed(1_000_000n), gross: aed(1_050_000n) },
    creditLimit: 5_000_000n,
    creditUsed: 0n,
  }
  const reasons = (input: Parameters<typeof approvalsFor>[0]) =>
    approvalsFor(input).map((a) => `${a.kind}/${a.reason}`)

  it('needs nothing for an owner within credit at normal prices', () => {
    expect(approvalsFor(base)).toEqual([])
  })

  it('needs the owner when a purchaser goes above their threshold (net)', () => {
    expect(
      reasons({ ...base, placer: { role: 'purchaser', approvalThreshold: 999_999n } }),
    ).toEqual(['company/threshold'])
    expect(
      reasons({ ...base, placer: { role: 'purchaser', approvalThreshold: 1_000_000n } }),
    ).toEqual([])
    expect(reasons({ ...base, placer: { role: 'purchaser', approvalThreshold: null } })).toEqual([])
  })

  it('needs Alpha over the credit limit, without a credit line, or below the floor', () => {
    expect(reasons({ ...base, creditUsed: 3_950_001n })).toEqual(['alpha/credit'])
    expect(reasons({ ...base, creditUsed: 3_950_000n })).toEqual([])
    expect(reasons({ ...base, creditLimit: null })).toEqual(['alpha/credit'])
    expect(reasons({ ...base, lines: [{ status: 'ok' }, { status: 'needs-approval' }] })).toEqual([
      'alpha/price',
    ])
    expect(approvalsFor({ ...base, creditLimit: null })[0]).toEqual({
      kind: 'alpha',
      reason: 'credit',
      status: 'pending',
      by: null,
      at: null,
      note: null,
    })
  })
})

describe('creditPosition', () => {
  it('reports limit, used and available, never below zero', () => {
    expect(creditPosition(5_000_000n, 1_200_000n, aed(0n))).toEqual({
      limit: aed(5_000_000n),
      used: aed(1_200_000n),
      available: aed(3_800_000n),
    })
    expect(creditPosition(100n, 300n, aed(0n)).available).toEqual(aed(0n))
    expect(creditPosition(null, 300n, aed(0n))).toEqual({
      limit: null,
      used: aed(300n),
      available: null,
    })
  })
})
