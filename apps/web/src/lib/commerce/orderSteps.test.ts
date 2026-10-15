import { describe, expect, it } from 'vitest'
import { money } from '@alpha/core'
import type { ShopperOrder } from '@alpha/payload'
import { getDictionary, translator } from '@alpha/ui'
import { orderSteps } from './orderSteps'

const t = translator(getDictionary('en'))
const aed = money(100, 'AED', 2)
const base: ShopperOrder = {
  number: 'AE-2026-000001',
  market: 'ae',
  locale: 'en',
  status: 'confirmed',
  failureReason: null,
  lines: [],
  totals: { subtotal: aed, vat: aed, delivery: aed, total: aed },
  fulfilment: 'awaiting',
  placedAt: new Date('2026-10-15T06:00:00Z'),
  refund: { status: 'none', amount: null },
  shipment: null,
}
const at = (d: Date) => d.toISOString()
const states = (order: ShopperOrder) => orderSteps(order, t, at).map((s) => [s.key, s.state])

describe('orderSteps', () => {
  it('folds picking and packing into "being prepared" until the parcel leaves', () => {
    for (const fulfilment of ['awaiting', 'picking', 'picked', 'shipping'] as const) {
      expect(states({ ...base, fulfilment })).toEqual([
        ['confirmed', 'done'],
        ['picked', 'current'],
        ['shipped', 'upcoming'],
        ['delivered', 'upcoming'],
      ])
    }
  })

  it('shows the courier while on its way, and every step done once delivered', () => {
    const shipment = {
      courier: 'Aramex',
      trackingNumber: '4421',
      trackingUrl: null,
      shippedAt: new Date('2026-10-16T06:00:00Z'),
      deliveredAt: null,
    }
    const shipped = orderSteps({ ...base, fulfilment: 'shipped', shipment }, t, at)
    expect(shipped.map((s) => s.state)).toEqual(['done', 'done', 'current', 'upcoming'])
    expect(shipped[2]?.detail).toBe('2026-10-16T06:00:00.000Z · With Aramex, tracking number 4421')
    const delivered = orderSteps(
      {
        ...base,
        fulfilment: 'delivered',
        shipment: { ...shipment, deliveredAt: new Date('2026-10-17T06:00:00Z') },
      },
      t,
      at,
    )
    expect(delivered.map((s) => s.state)).toEqual(['done', 'done', 'done', 'done'])
    expect(delivered[3]?.detail).toBe('2026-10-17T06:00:00.000Z')
  })

  it('stops at cancelled, and waits while the payment is not confirmed', () => {
    expect(states({ ...base, fulfilment: 'cancelled' })).toEqual([
      ['confirmed', 'done'],
      ['cancelled', 'stopped'],
    ])
    expect(states({ ...base, status: 'paying' })).toEqual([['payment', 'current']])
  })
})
