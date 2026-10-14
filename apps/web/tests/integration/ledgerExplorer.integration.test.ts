import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { createLedger } from '@alpha/payload'
import { LedgerExplorerContent } from '@alpha/payload/admin/LedgerExplorerContent'
import { loadLedgerExplorer } from '@alpha/payload/admin/ledgerExplorerData'
import { seedInventory, staff } from './helpers/ledger'
import { usePayload } from './helpers/suite'

const payload = usePayload()

describe('Ledger explorer', () => {
  it("shows a serial's full history in order", async () => {
    const { main, demo } = await seedInventory(payload())
    const user = await staff(payload())
    let clock = Date.parse('2026-10-14T08:00:00Z')
    const ledger = createLedger(payload(), () => new Date((clock += 60_000)))
    const serial = 'MC462-0001'

    await ledger.move({
      sku: 'MC462',
      qty: 1,
      serial,
      from: null,
      to: 'received',
      location: main,
      doc: { type: 'receipt', id: 'GR-7' },
      user: user.id,
    })
    await ledger.move({
      sku: 'MC462',
      qty: 1,
      serial,
      from: 'received',
      to: 'available',
      location: main,
      doc: { type: 'receipt', id: 'GR-7' },
      user: user.id,
    })
    await ledger.transfer({
      sku: 'MC462',
      qty: 1,
      serial,
      from: { location: main, state: 'available' },
      to: { location: demo, state: 'demo' },
      doc: { type: 'transfer', id: 'TR-3' },
    })
    await ledger.transfer({
      sku: 'MC462',
      qty: 1,
      serial,
      from: { location: demo, state: 'demo' },
      to: { location: main, state: 'available' },
      doc: { type: 'transfer', id: 'TR-4' },
    })
    const held = await ledger.reserve({
      sku: 'MC462',
      qty: 1,
      location: main,
      doc: { type: 'order', id: 'AE-1042' },
    })
    if (!held.ok) throw new Error('expected a reservation')
    await ledger.pick(held.reservation.id)
    await ledger.ship({
      sku: 'MC462',
      qty: 1,
      serial,
      location: main,
      doc: { type: 'shipment', id: 'SH-9' },
    })
    // Noise: another serial must not appear in this history.
    await ledger.move({
      sku: 'MC462',
      qty: 1,
      serial: 'MC462-0002',
      from: null,
      to: 'available',
      location: main,
      doc: { type: 'receipt', id: 'GR-8' },
    })

    const result = await loadLedgerExplorer(payload(), user, { serial })
    const steps = result.movements.map(
      (m) => `${m.from ?? '∅'}→${m.to ?? '∅'} @${m.location} ${m.doc}`,
    )
    expect(steps).toEqual([
      '∅→received @A01 receipt GR-7',
      'received→available @A01 receipt GR-7',
      'available→∅ @A01 transfer TR-3',
      '∅→demo @DEMO transfer TR-3',
      'demo→∅ @DEMO transfer TR-4',
      '∅→available @A01 transfer TR-4',
      'available→reserved @A01 order AE-1042',
      'reserved→picked @A01 order AE-1042',
      'picked→shipped @A01 shipment SH-9',
    ])
    expect(result.movements.map((m) => m.at)).toEqual([...result.movements.map((m) => m.at)].sort())
    expect(result.serial).toEqual({ serial, sku: 'MC462', state: 'shipped', location: 'A01' })
    expect(result.movements[0]?.user).toBe('ops@alpha.test')

    const html = renderToStaticMarkup(
      createElement(LedgerExplorerContent, { result, basePath: '/admin/ledger' }),
    )
    const rendered = [...html.matchAll(/data-movement="(\d+)"/g)].map((m) => Number(m[1]))
    expect(rendered).toEqual(result.movements.map((m) => Number(m.id)))
    expect(rendered).toEqual([...rendered].sort((a, b) => a - b))
    expect(html).toContain('is <strong>shipped</strong> at <strong>A01</strong>')
  })

  it('shows a SKU with its non-zero levels by location and state', async () => {
    const { main, showroom } = await seedInventory(payload())
    const user = await staff(payload())
    const ledger = createLedger(payload())
    await ledger.move({
      sku: 'C12000',
      qty: 4,
      from: null,
      to: 'available',
      location: main,
      doc: { type: 'receipt', id: 'GR-9' },
    })
    await ledger.transfer({
      sku: 'C12000',
      qty: 1,
      from: { location: main, state: 'available' },
      to: { location: showroom, state: 'ex_display' },
      doc: { type: 'transfer', id: 'TR-9' },
    })
    await ledger.reserve({
      sku: 'C12000',
      qty: 2,
      location: main,
      doc: { type: 'quote', id: 'Q-9' },
    })

    const result = await loadLedgerExplorer(payload(), user, { sku: 'C12000' })
    expect(result.levels).toEqual([
      { location: 'A01', state: 'available', qty: 1 },
      { location: 'A01', state: 'reserved', qty: 2 },
      { location: 'SHOW', state: 'ex_display', qty: 1 },
    ])
    expect(result.movements).toHaveLength(4)
    expect(result.truncated).toBe(false)
  })

  it('shows nothing to someone who is not staff', async () => {
    const error = await loadLedgerExplorer(payload(), null, { sku: 'C12000' }).catch(
      (e: unknown) => e,
    )
    expect((error as { status?: number }).status).toBe(403)
  })
})
