import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import { LedgerExplorerContent } from './LedgerExplorerContent'
import { loadLedgerExplorer } from './ledgerExplorerData'

export const LEDGER_EXPLORER_PATH = '/ledger'

const param = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

/**
 * Admin view at /admin/ledger: a SKU's levels and movements, or a serial's full history in
 * the order the ledger wrote it. Custom admin views are public by default, so it checks for a
 * staff session itself; the data is read with the user's own access rules.
 */
export async function LedgerExplorer({
  initPageResult,
  params,
  searchParams,
}: AdminViewServerProps) {
  const { req, permissions, visibleEntities, locale } = initPageResult
  const adminRoute = req.payload.config.routes.admin
  if (req.user?.collection !== 'users')
    redirect(
      `${adminRoute}/login?redirect=${encodeURIComponent(`${adminRoute}${LEDGER_EXPLORER_PATH}`)}`,
    )

  const result = await loadLedgerExplorer(req.payload, req.user, {
    sku: param(searchParams?.['sku']),
    serial: param(searchParams?.['serial']),
  })

  return (
    <DefaultTemplate
      i18n={req.i18n}
      {...(locale ? { locale } : {})}
      {...(params ? { params } : {})}
      payload={req.payload}
      permissions={permissions}
      {...(searchParams ? { searchParams } : {})}
      user={req.user}
      visibleEntities={visibleEntities}
    >
      <Gutter>
        <h1>Ledger explorer</h1>
        <LedgerExplorerContent result={result} basePath={`${adminRoute}${LEDGER_EXPLORER_PATH}`} />
      </Gutter>
    </DefaultTemplate>
  )
}
