import type { CSSProperties } from 'react'
import type { DocType, StockState } from '@alpha/core'
import type { ExplorerResult } from './ledgerExplorerData'

/**
 * The Ledger explorer's body: search form, levels and movements. Pure markup styled with the
 * Payload admin's theme variables, so it follows the admin's light and dark themes.
 */
const cell: CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid var(--theme-elevation-100)',
  textAlign: 'start',
  whiteSpace: 'nowrap',
}
const head: CSSProperties = { ...cell, fontWeight: 600, color: 'var(--theme-elevation-800)' }
const muted: CSSProperties = { color: 'var(--theme-elevation-500)' }
const state = (value: string | null) => value ?? <span style={muted}>out of ledger</span>

/** What an empty side of a movement means, by its document: stock entering or leaving the ledger. */
const ENTERS: Partial<Record<DocType, string>> = {
  receipt: 'goods in',
  opening: 'opening stock',
  transfer: 'transfer in',
  count: 'count gain',
  rma: 'returned',
}
const LEAVES: Partial<Record<DocType, string>> = {
  transfer: 'transfer out',
  count: 'count loss',
  adjustment: 'written off',
}
const side = (value: StockState | null, docType: DocType, entering: boolean) =>
  value ?? <span style={muted}>{(entering ? ENTERS : LEAVES)[docType] ?? 'out of ledger'}</span>

export function LedgerExplorerContent({
  result,
  basePath,
}: {
  result: ExplorerResult
  basePath: string
}) {
  const { query, movements, levels, serial, truncated } = result
  const searched = Boolean(query.sku || query.serial)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBlock: 24 }}>
      <form
        method="get"
        action={basePath}
        style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end' }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          SKU
          <input
            name="sku"
            defaultValue={query.serial ? '' : (query.sku ?? '')}
            placeholder="MA352"
            style={{ minHeight: 40, paddingInline: 10 }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          Serial number
          <input
            name="serial"
            defaultValue={query.serial ?? ''}
            placeholder="SN-0001"
            style={{ minHeight: 40, paddingInline: 10 }}
          />
        </label>
        <button
          type="submit"
          className="btn btn--style-primary btn--size-medium"
          style={{ margin: 0 }}
        >
          Show history
        </button>
      </form>

      {!searched ? (
        <p style={muted}>
          Enter a SKU to see its levels and latest movements, or a serial number for its full
          history.
        </p>
      ) : null}

      {serial ? (
        <p data-testid="serial-current">
          Serial <strong>{serial.serial}</strong> ({serial.sku}) is{' '}
          <strong>{state(serial.state)}</strong>
          {serial.location ? (
            <>
              {' '}
              at <strong>{serial.location}</strong>
            </>
          ) : null}
          .
        </p>
      ) : searched && query.serial ? (
        <p>No serial number {query.serial} in the ledger.</p>
      ) : null}

      {searched && query.sku && !query.serial ? (
        <section aria-labelledby="levels-heading">
          <h2 id="levels-heading">Levels for {query.sku}</h2>
          {levels.length ? (
            <table style={{ borderCollapse: 'collapse' }} data-testid="levels">
              <thead>
                <tr>
                  <th style={head}>Location</th>
                  <th style={head}>State</th>
                  <th style={{ ...head, textAlign: 'end' }}>Qty</th>
                </tr>
              </thead>
              <tbody>
                {levels.map((l) => (
                  <tr key={`${l.location}-${l.state}`}>
                    <td style={cell}>{l.location}</td>
                    <td style={cell}>{l.state}</td>
                    <td style={{ ...cell, textAlign: 'end', fontVariantNumeric: 'tabular-nums' }}>
                      {l.qty}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={muted}>No stock of {query.sku} anywhere.</p>
          )}
        </section>
      ) : null}

      {searched ? (
        <section aria-labelledby="movements-heading">
          <h2 id="movements-heading">
            {query.serial ? `History of ${query.serial}` : `Movements of ${query.sku ?? ''}`}
          </h2>
          {truncated ? <p style={muted}>Showing the latest 500 movements.</p> : null}
          {movements.length ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse' }} data-testid="movements">
                <thead>
                  <tr>
                    {[
                      '#',
                      'When (UTC)',
                      'SKU',
                      'Serial',
                      'Qty',
                      'From',
                      'To',
                      'Location',
                      'Document',
                      'By',
                      'Reason',
                    ].map((h) => (
                      <th key={h} style={head}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m, i) => (
                    <tr key={m.id} data-movement={m.id}>
                      <td style={{ ...cell, ...muted }}>{i + 1}</td>
                      <td style={cell}>{m.at.replace('T', ' ').slice(0, 19)}</td>
                      <td style={cell}>{m.sku}</td>
                      <td style={cell}>{m.serial ?? ''}</td>
                      <td style={{ ...cell, textAlign: 'end', fontVariantNumeric: 'tabular-nums' }}>
                        {m.qty}
                      </td>
                      <td style={cell}>{side(m.from, m.docType, true)}</td>
                      <td style={cell}>{side(m.to, m.docType, false)}</td>
                      <td style={cell}>{m.location}</td>
                      <td style={cell}>{m.doc}</td>
                      <td style={cell}>{m.user ?? <span style={muted}>system</span>}</td>
                      <td style={{ ...cell, whiteSpace: 'normal' }}>{m.reason ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={muted}>No movements.</p>
          )}
        </section>
      ) : null}
    </div>
  )
}
