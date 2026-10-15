import type { Metadata } from 'next'
import { partnerCatalogue } from '@alpha/payload'
import { Button, Input, Pagination, PartnerCatalogueTable, PriceTraceDrawer } from '@alpha/ui'
import { BoardShell } from '@/components/BoardShell'
import { catalogueView } from '@/lib/catalogueView'
import { copy, formatLocale, pageLocale } from '@/lib/locale'
import { requirePartner } from '@/lib/session'

type Search = Promise<Record<string, string | string[] | undefined>>

export async function generateMetadata(): Promise<Metadata> {
  return { title: copy(await pageLocale())('partners.catalogue.title') }
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

/**
 * The dealer catalogue (docs/tasks/0014): products on sale in the company's market with its own
 * price, the RRP, why the price is what it is, and stock as the company may see it. Every figure
 * comes from `partnerCatalogue` (packages/payload, core price engine).
 */
export default async function CataloguePage({ searchParams }: { searchParams: Search }) {
  const partner = await requirePartner()
  const params = await searchParams
  const q = first(params['q']) ?? ''
  const page = Number.parseInt(first(params['page']) ?? '1', 10)
  const { account } = partner
  const locale = account.user.locale
  const t = copy(locale)
  const catalogue = await partnerCatalogue(partner.payload, partner.user, {
    locale,
    q,
    page: Number.isSafeInteger(page) ? page : 1,
  })
  const ctx = {
    t,
    locale: formatLocale(locale, account.company.market),
    timezone: account.timezone,
    currency: account.currency,
    decimals: account.decimals,
    channel: catalogue?.company.channel ?? 'dealer',
  }
  const view = catalogue ? catalogueView(catalogue.rows, ctx) : []
  const stateLabels = {
    applied: t('partners.trace.applied'),
    checked: t('partners.trace.checked'),
    skipped: t('partners.trace.skipped'),
  }
  const hrefFor = (n: number) => {
    const query = new URLSearchParams({
      ...(catalogue?.query ? { q: catalogue.query } : {}),
      page: String(n),
    })
    return `/catalogue?${query.toString()}`
  }

  return (
    <BoardShell partner={partner} current="catalogue">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-bold text-ink font-stretch-expanded">
            {t('partners.catalogue.title')}
          </h1>
          <p className="text-base text-ink-muted" role="status">
            {catalogue?.query
              ? t('partners.catalogue.results', { count: catalogue.total, query: catalogue.query })
              : t('partners.catalogue.count', { count: catalogue?.total ?? 0 })}
          </p>
          <p className="text-sm text-ink-muted">
            {account.vatRate > 0
              ? t('partners.catalogue.vatNote', { rate: account.vatRate })
              : t('partners.catalogue.noVatNote')}
          </p>
        </div>
        <form
          method="get"
          action="/catalogue"
          role="search"
          className="flex flex-wrap items-end gap-3"
        >
          <div className="min-w-64 flex-1">
            <Input
              label={t('partners.catalogue.search')}
              name="q"
              type="search"
              defaultValue={catalogue?.query ?? ''}
              maxLength={100}
            />
          </div>
          <Button type="submit" variant="secondary" icon="search">
            {t('partners.catalogue.searchSubmit')}
          </Button>
          {catalogue?.query ? (
            <Button href="/catalogue" variant="quiet">
              {t('partners.catalogue.clear')}
            </Button>
          ) : null}
        </form>
        {view.length === 0 ? (
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold text-ink">{t('partners.catalogue.empty')}</p>
            <p className="text-base text-ink-muted">{t('partners.catalogue.emptyBody')}</p>
          </div>
        ) : (
          <PartnerCatalogueTable
            caption={t('partners.catalogue.caption')}
            columns={{
              product: t('partners.catalogue.product'),
              rrp: t('partners.catalogue.rrp'),
              price: t('partners.catalogue.price'),
              stock: t('partners.catalogue.stock'),
            }}
            statusLabels={{
              'needs-approval': t('partners.catalogue.needsApproval'),
              unavailable: t('partners.catalogue.unavailable'),
            }}
            rows={view.map(({ row, trace }) => ({
              ...row,
              trace: trace.length ? (
                <PriceTraceDrawer
                  label={t('partners.trace.label')}
                  rows={trace}
                  stateLabels={stateLabels}
                  emptyLabel={t('partners.trace.empty')}
                />
              ) : undefined,
            }))}
          />
        )}
        {catalogue ? (
          <Pagination
            label={t('partners.catalogue.pagination')}
            current={catalogue.page}
            pages={catalogue.pages}
            hrefFor={hrefFor}
            previousLabel={t('partners.catalogue.previous')}
            nextLabel={t('partners.catalogue.next')}
            pageLabel={t('partners.catalogue.page')}
          />
        ) : null}
      </div>
    </BoardShell>
  )
}
