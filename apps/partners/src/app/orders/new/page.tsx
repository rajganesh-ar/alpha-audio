import type { Metadata } from 'next'
import { randomUUID } from 'node:crypto'
import { formatMoney } from '@alpha/core'
import { previewTradeOrder } from '@alpha/payload'
import { Button, Input, OrderSummary, QuickOrder, type MessageKey } from '@alpha/ui'
import { BoardShell } from '@/components/BoardShell'
import { Credit } from '@/components/Credit'
import { LineTrace } from '@/components/LineTrace'
import { Notice } from '@/components/Notice'
import { OrderLines } from '@/components/OrderLines'
import { copy, formatLocale, pageLocale } from '@/lib/locale'
import { draftLines, problemText } from '@/lib/orders'
import { requirePartner } from '@/lib/session'

type Search = Promise<Record<string, string | string[] | undefined>>

const PLACE_STATUSES = ['unavailable', 'in-progress', 'rules', 'not-allowed', 'on-hold', 'error']
const list = (v: string | string[] | undefined) =>
  v === undefined ? [] : Array.isArray(v) ? v : [v]

export async function generateMetadata(): Promise<Metadata> {
  return { title: copy(await pageLocale())('partners.order.title') }
}

/**
 * New dealer order (docs/tasks/0015): the quick-order lines, reviewed with the company's prices,
 * rules, approvals and credit, then placed with a POST that carries an idempotency key. Works
 * without JavaScript: the review is a GET of this page.
 */
export default async function NewOrderPage({ searchParams }: { searchParams: Search }) {
  const partner = await requirePartner()
  const params = await searchParams
  const { account } = partner
  const locale = account.user.locale
  const t = copy(locale)
  const fmt = formatLocale(locale, account.company.market)
  const lines = draftLines(list(params['sku']), list(params['qty']))
  const draft = await previewTradeOrder(partner.payload, partner.user, lines, { locale })
  const status = list(params['status'])[0]
  const known = status && PLACE_STATUSES.includes(status) ? status : null
  const ctx = {
    t,
    locale: fmt,
    timezone: account.timezone,
    currency: account.currency,
    decimals: account.decimals,
    channel: draft?.session.company.channel ?? 'dealer',
  }
  const problems = draft ? problemText(draft.problems, t, fmt) : { lines: new Map(), order: [] }
  const reviewing = lines.length > 0 && draft !== null
  const blocked = problems.lines.size > 0 || problems.order.length > 0
  const pending = (draft?.approvals.length ?? 0) > 0
  const money = (m: Parameters<typeof formatMoney>[0] | null) =>
    m ? formatMoney(m, fmt) : undefined

  return (
    <BoardShell partner={partner} current="orders">
      <div className="flex flex-col gap-8">
        <h1 className="font-display text-3xl font-bold text-ink font-stretch-expanded">
          {t('partners.order.title')}
        </h1>
        {known ? (
          <Notice tone="critical">
            {t(`partners.order.status.${known}` as MessageKey, {
              skus: list(params['skus'])[0] ?? '',
            })}
          </Notice>
        ) : null}
        {draft && !draft.canOrder ? (
          <Notice tone="critical">
            {draft.hold ? t('partners.order.onHold') : t('partners.order.cannotOrder')}
          </Notice>
        ) : null}
        {draft?.credit ? <Credit credit={draft.credit} t={t} locale={fmt} /> : null}
        <QuickOrder
          action="/orders/new"
          legend={t('partners.order.legend')}
          hint={t('partners.order.hint')}
          lineLabel={t('partners.order.line')}
          skuLabel={t('partners.order.sku')}
          qtyLabel={t('partners.order.qty')}
          submitLabel={t('partners.order.review')}
          rows={(draft?.lines ?? lines).map((l) => ({
            sku: l.sku,
            qty: String(l.qty),
            error: problems.lines.get(l.sku),
          }))}
          blankRows={lines.length ? 2 : 4}
        />
        {reviewing && draft ? (
          <section aria-labelledby="review" className="flex flex-col gap-6">
            <h2 id="review" className="font-display text-2xl font-bold text-ink">
              {t('partners.order.reviewTitle')}
            </h2>
            {blocked ? (
              <div role="alert" className="flex flex-col gap-1">
                <p className="font-semibold text-critical">{t('partners.order.fix')}</p>
                {problems.order.map((p) => (
                  <p key={p} className="text-critical">
                    {p}
                  </p>
                ))}
              </div>
            ) : null}
            <OrderLines
              caption={t('partners.order.reviewTitle')}
              columns={{
                product: t('partners.catalogue.product'),
                qty: t('partners.order.qty'),
                unit: t('partners.order.unit'),
                total: t('partners.order.lineTotal'),
              }}
              lines={draft.lines.map((l) => ({
                sku: l.sku,
                title: l.title,
                qty: l.qty,
                unit: money(l.unit),
                total: money(l.total),
                note:
                  problems.lines.get(l.sku) ??
                  (l.status === 'needs-approval'
                    ? t('partners.catalogue.needsApproval')
                    : undefined),
                critical: problems.lines.has(l.sku) || l.status === 'needs-approval',
                trace: <LineTrace trace={l.trace} ctx={ctx} />,
              }))}
            />
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="flex flex-col gap-2">
                <p className="font-semibold text-ink">
                  {pending ? t('partners.order.approvalsNeeded') : t('partners.order.noApprovals')}
                </p>
                {pending ? (
                  <ul className="m-0 list-disc ps-6 text-ink">
                    {draft.approvals.map((a) => (
                      <li key={`${a.kind}-${a.reason}`}>
                        {t(`partners.orders.approval.${a.kind}`)}:{' '}
                        {t(`partners.orders.reasons.${a.reason}`)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <OrderSummary
                title={t('partners.orders.total')}
                rows={[
                  { label: t('partners.order.net'), value: formatMoney(draft.totals.net, fmt) },
                  {
                    label: t('partners.order.vat', { rate: draft.session.context.vatRate }),
                    value: formatMoney(draft.totals.vat, fmt),
                    muted: true,
                  },
                  {
                    label: t('partners.order.gross'),
                    value: formatMoney(draft.totals.gross, fmt),
                    emphasis: true,
                  },
                ]}
              />
            </div>
            {draft.canOrder && !blocked ? (
              <form method="post" action="/api/v1/orders" className="flex flex-col gap-4">
                <input type="hidden" name="idempotencyKey" value={randomUUID()} />
                {draft.lines.map((l) => (
                  <span key={l.sku}>
                    <input type="hidden" name="sku" value={l.sku} />
                    <input type="hidden" name="qty" value={String(l.qty)} />
                  </span>
                ))}
                <div className="grid gap-4 lg:grid-cols-2">
                  <Input
                    label={t('partners.order.poNumber')}
                    name="poNumber"
                    maxLength={64}
                    dir="ltr"
                  />
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-ink">
                      {t('partners.order.note')}
                    </span>
                    <textarea
                      name="note"
                      maxLength={1000}
                      rows={2}
                      className="w-full rounded-control border border-line-strong bg-transparent px-3 py-2 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    />
                  </label>
                </div>
                <div>
                  <Button type="submit" icon="arrow-forward" iconPosition="end">
                    {pending ? t('partners.order.placePending') : t('partners.order.place')}
                  </Button>
                </div>
              </form>
            ) : null}
          </section>
        ) : lines.length === 0 ? (
          <p className="text-base text-ink-muted">{t('partners.order.empty')}</p>
        ) : null}
      </div>
    </BoardShell>
  )
}
