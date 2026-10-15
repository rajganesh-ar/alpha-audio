import type { Metadata } from 'next'
import { formatMoney } from '@alpha/core'
import { Badge, Button, EmptyState, type MessageKey } from '@alpha/ui'
import { BoardShell } from '@/components/BoardShell'
import { Notice } from '@/components/Notice'
import { OrderLines } from '@/components/OrderLines'
import { copy, formatLocale, pageLocale } from '@/lib/locale'
import { PROJECT_TONE, dateTime, projectStateOf } from '@/lib/orderStatus'
import { reviewQuery, storedMoney } from '@/lib/orders'
import { requirePartner } from '@/lib/session'
import type { ProjectRegistration } from '@/payload-types'

type Params = Promise<{ number: string }>
type Search = Promise<Record<string, string | string[] | undefined>>

const RESULTS = ['registered', 'withdrawn', 'not-found', 'not-submitted', 'busy', 'forbidden']

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { number } = await params
  return { title: `${copy(await pageLocale())('partners.projects.number')} ${number}` }
}

/** One project registration: status, lines with project prices, and ordering for it. */
export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: Search
}) {
  const partner = await requirePartner()
  const { number } = await params
  const search = await searchParams
  const { account } = partner
  const locale = account.user.locale
  const t = copy(locale)
  const fmt = formatLocale(locale, account.company.market)
  const found = await partner.payload.find({
    collection: 'project-registrations',
    where: { number: { equals: number } },
    user: partner.user as never, // reason: the signed-in company user from payload.auth
    overrideAccess: false,
    depth: 0,
    limit: 1,
  })
  const project = found.docs[0] as ProjectRegistration | undefined
  // Rendered inline, not with notFound(): the board works without JavaScript (see orders page).
  if (!project)
    return (
      <BoardShell partner={partner} current="projects">
        <EmptyState
          title={t('notFound.title')}
          body={t('partners.notFound')}
          action={<Button href="/projects">{t('partners.projects.back')}</Button>}
        />
      </BoardShell>
    )
  const state = projectStateOf(project.status, project.validUntil)
  const canAct = ['owner', 'purchaser'].includes(account.user.role)
  const result = typeof search['result'] === 'string' ? search['result'] : null
  const known = result && RESULTS.includes(result) ? result : null
  const lines = project.lines ?? []
  const currency = { currency: account.currency, decimals: account.decimals }
  const orderHref = `/orders/new?${reviewQuery(
    lines.map((l) => ({ sku: l.sku, qty: l.qty })),
    { project: project.number },
  )}`

  return (
    <BoardShell partner={partner} current="projects">
      <div className="flex flex-col gap-6">
        <a
          href="/projects"
          className="inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-4"
        >
          {t('partners.projects.back')}
        </a>
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="font-display text-3xl font-bold text-ink font-stretch-expanded">
            {project.name} <bdi className="font-mono text-xl">{project.number}</bdi>
          </h1>
          <Badge label={t(`partners.projects.statuses.${state}`)} tone={PROJECT_TONE[state]} />
        </div>
        {known ? (
          <Notice tone={known === 'registered' || known === 'withdrawn' ? 'info' : 'critical'}>
            {t(`partners.projects.results.${known}` as MessageKey)}
          </Notice>
        ) : null}
        <dl className="grid gap-x-8 gap-y-2 text-base sm:grid-cols-4">
          <div>
            <dt className="text-sm text-ink-muted">{t('partners.projects.endCustomer')}</dt>
            <dd className="text-ink">{project.endCustomer}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">{t('partners.projects.city')}</dt>
            <dd className="text-ink">{project.city ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">{t('partners.projects.expectedClose')}</dt>
            <dd className="text-ink">
              {new Intl.DateTimeFormat(fmt, { dateStyle: 'medium', timeZone: 'UTC' }).format(
                new Date(project.expectedClose),
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">{t('partners.projects.validUntil')}</dt>
            <dd className="text-ink">
              {project.validUntil ? dateTime(project.validUntil, fmt, account.timezone) : '—'}
            </dd>
          </div>
        </dl>
        {project.decisionNote ? (
          <p className="text-base text-ink">
            {t('partners.projects.decisionNote', { note: project.decisionNote })}
          </p>
        ) : null}
        <OrderLines
          caption={t('partners.projects.products')}
          columns={{
            product: t('partners.catalogue.product'),
            qty: t('partners.order.qty'),
            unit: t('partners.projects.projectPrice'),
            total: ' ',
          }}
          lines={lines.map((l) => {
            const price = storedMoney(l.projectPrice, currency)
            return {
              sku: l.sku,
              title: l.title,
              qty: l.qty,
              unit: price ? formatMoney(price, fmt) : undefined,
              note:
                state === 'approved' && !price ? t('partners.projects.noProjectPrice') : undefined,
            }
          })}
        />
        {canAct && (state === 'approved' || state === 'submitted') ? (
          <div className="flex flex-wrap gap-3">
            {state === 'approved' ? (
              <Button href={orderHref} icon="arrow-forward" iconPosition="end">
                {t('partners.projects.orderFor')}
              </Button>
            ) : null}
            <form
              method="post"
              action={`/api/v1/projects/${encodeURIComponent(project.number)}/withdraw`}
            >
              <Button type="submit" variant="secondary">
                {t('partners.projects.withdraw')}
              </Button>
            </form>
          </div>
        ) : null}
      </div>
    </BoardShell>
  )
}
