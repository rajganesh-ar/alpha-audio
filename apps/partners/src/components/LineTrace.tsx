import type { TraceStep } from '@alpha/core'
import { PriceTraceDrawer } from '@alpha/ui'
import { traceRows, type ViewContext } from '@/lib/catalogueView'

/** "Why this price" for one line, or nothing when there is no trace. */
export function LineTrace({ trace, ctx }: { trace: readonly TraceStep[]; ctx: ViewContext }) {
  if (!trace.length) return null
  const { t } = ctx
  return (
    <PriceTraceDrawer
      label={t('partners.trace.label')}
      rows={traceRows(trace, ctx)}
      stateLabels={{
        applied: t('partners.trace.applied'),
        checked: t('partners.trace.checked'),
        skipped: t('partners.trace.skipped'),
      }}
      emptyLabel={t('partners.trace.empty')}
    />
  )
}
