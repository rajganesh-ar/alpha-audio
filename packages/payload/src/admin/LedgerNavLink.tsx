/** Link to the Ledger explorer, shown after the collection links in the admin navigation. */
export function LedgerNavLink() {
  return (
    <a href="/admin/ledger" className="nav__link" style={{ display: 'block', paddingBlock: 8 }}>
      Ledger explorer
    </a>
  )
}
