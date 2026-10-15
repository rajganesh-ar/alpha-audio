import {
  formatMoney,
  money,
  type CurrencyCode,
  type CurrencyDecimals,
  type TraceStep,
} from '@alpha/core'
import type { PartnerCatalogueRow as Row } from '@alpha/payload'
import type { PartnerCatalogueRow as TableRow, TraceRow, Translate } from '@alpha/ui'

/**
 * Turns the catalogue service's rows into what the dealer catalogue table shows: formatted
 * money, translated statuses, stock words and the "why this price" rows. Pure, so it is unit
 * tested; figures all come from the service (CLAUDE.md rule 2).
 */
export interface ViewContext {
  t: Translate
  /** Intl locale with Western digits, e.g. `ar-AE-u-nu-latn`. */
  locale: string
  timezone: string
  currency: CurrencyCode
  decimals: CurrencyDecimals
  channel: 'dealer' | 'integrator' | 'retailer'
}

export interface CatalogueViewRow {
  row: Omit<TableRow, 'trace'>
  trace: TraceRow[]
}

const BASE_RULES: ReadonlySet<TraceStep['rule']> = new Set([
  'contract',
  'project',
  'price-list',
  'dealer-list',
])

/** A trace value: a base price (`6900.00`) as money, an adjustment (`-5%`) as a percentage. */
export function traceValue(step: TraceStep, ctx: ViewContext): string | undefined {
  if (!step.matched || step.value === null) return undefined
  if (BASE_RULES.has(step.rule) && /^\d+(\.\d+)?$/.test(step.value)) {
    const [whole = '0', fraction = ''] = step.value.split('.')
    const minor = BigInt(whole + fraction.padEnd(ctx.decimals, '0').slice(0, ctx.decimals))
    return formatMoney(money(minor, ctx.currency, ctx.decimals), ctx.locale)
  }
  return step.value.replace(/^-/, '−')
}

export function traceRows(trace: readonly TraceStep[], ctx: ViewContext): TraceRow[] {
  const { t } = ctx
  return trace.map((step) => ({
    label:
      step.rule === 'dealer-list'
        ? t('partners.trace.rules.dealer-list', { channel: t(`partners.channel.${ctx.channel}`) })
        : t(`partners.trace.rules.${step.rule}`),
    value: traceValue(step, ctx),
    state: step.matched ? 'applied' : step.seen ? 'checked' : 'skipped',
  }))
}

/** Stock as words: the band, "Low", or out of stock with the expected date. */
export function stockText(stock: Row['stock'], ctx: ViewContext): string | undefined {
  if (stock.band === null) return undefined
  if (stock.band === 'Low') return ctx.t('partners.stock.low')
  if (stock.band !== '0') return stock.band
  if (!stock.eta) return ctx.t('partners.stock.none')
  const date = new Intl.DateTimeFormat(ctx.locale, {
    dateStyle: 'medium',
    timeZone: ctx.timezone,
  }).format(new Date(stock.eta))
  return ctx.t('partners.stock.eta', { date })
}

export function catalogueView(rows: readonly Row[], ctx: ViewContext): CatalogueViewRow[] {
  return rows.map((r) => ({
    row: {
      sku: r.sku,
      title: r.title,
      brand: r.brand ?? undefined,
      rrp: r.rrpInclVat ? formatMoney(r.rrpInclVat, ctx.locale) : undefined,
      price: r.line.unit ? formatMoney(r.line.unit, ctx.locale) : undefined,
      status: r.line.status,
      stock: stockText(r.stock, ctx),
    },
    trace: r.line.status === 'unavailable' ? [] : traceRows(r.line.trace, ctx),
  }))
}
