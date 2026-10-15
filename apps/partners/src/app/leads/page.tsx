import type { Metadata } from 'next'
import { Button, Input, LeadCard, type MessageKey } from '@alpha/ui'
import { BoardShell } from '@/components/BoardShell'
import { Notice } from '@/components/Notice'
import { timeLeft } from '@/lib/leadTime'
import { copy, formatLocale, pageLocale } from '@/lib/locale'
import { dateTime } from '@/lib/orderStatus'
import { requirePartner } from '@/lib/session'
import type { Lead } from '@/payload-types'

type Search = Promise<Record<string, string | string[] | undefined>>

const RESULTS = [
  'accepted',
  'declined',
  'closed',
  'not-found',
  'not-yours',
  'not-offered',
  'too-late',
  'not-accepted',
  'forbidden',
  'invalid',
]

export async function generateMetadata(): Promise<Metadata> {
  return { title: copy(await pageLocale())('partners.leads.title') }
}

/**
 * Leads offered to or accepted by the company (docs/tasks/0018): what was asked and where, the
 * deadline in words, accept or decline; the shopper's contact appears only once accepted.
 */
export default async function LeadsPage({ searchParams }: { searchParams: Search }) {
  const partner = await requirePartner()
  const { account } = partner
  const locale = account.user.locale
  const t = copy(locale)
  const fmt = formatLocale(locale, account.company.market)
  const search = await searchParams
  const result = typeof search['result'] === 'string' ? search['result'] : null
  const known = result && RESULTS.includes(result) ? result : null
  const { docs } = await partner.payload.find({
    collection: 'leads',
    where: { status: { in: ['offered', 'accepted', 'closed'] } },
    user: partner.user as never, // reason: the signed-in company user from payload.auth
    overrideAccess: false,
    depth: 1,
    locale,
    sort: '-createdAt',
    limit: 100,
  })
  const canAct = ['owner', 'purchaser'].includes(account.user.role)
  const now = new Date()

  return (
    <BoardShell partner={partner} current="leads">
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-3xl font-bold text-ink font-stretch-expanded">
          {t('partners.leads.title')}
        </h1>
        <p className="text-base text-ink-muted">{t('partners.leads.intro')}</p>
        {known ? (
          <Notice tone={['accepted', 'declined', 'closed'].includes(known) ? 'info' : 'critical'}>
            {t(`partners.leads.results.${known}` as MessageKey)}
          </Notice>
        ) : null}
        {docs.length === 0 ? (
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold text-ink">{t('partners.leads.empty')}</p>
            <p className="text-base text-ink-muted">{t('partners.leads.emptyBody')}</p>
          </div>
        ) : (
          <ul className="m-0 grid list-none gap-4 p-0 lg:grid-cols-2">
            {(docs as Lead[]).map((lead) => {
              const product = typeof lead.product === 'object' && lead.product ? lead.product : null
              const brand = typeof lead.brand === 'object' && lead.brand ? lead.brand : null
              const state = lead.status as 'offered' | 'accepted' | 'closed'
              const left =
                state === 'offered' && lead.acceptBy
                  ? timeLeft(new Date(lead.acceptBy), now, t)
                  : null
              const action = (name: string) =>
                `/api/v1/leads/${encodeURIComponent(lead.number)}/${name}`
              return (
                <li key={lead.id} id={`lead-${lead.number}`}>
                  <LeadCard
                    number={lead.number}
                    product={product?.title ?? ''}
                    brand={brand?.name}
                    city={lead.city ?? undefined}
                    message={lead.message ?? undefined}
                    received={dateTime(lead.createdAt, fmt, account.timezone)}
                    state={state}
                    stateLabel={
                      state === 'closed' && lead.outcome
                        ? t(`partners.leads.outcomes.${lead.outcome}`)
                        : t(`partners.leads.states.${state}`)
                    }
                    deadline={
                      left && lead.acceptBy
                        ? t('partners.leads.deadline', {
                            date: dateTime(lead.acceptBy, fmt, account.timezone),
                            left: left.text,
                          })
                        : undefined
                    }
                    urgent={left?.urgent}
                    contact={
                      lead.contact
                        ? {
                            name: lead.contact.name ?? undefined,
                            email: lead.contact.email ?? undefined,
                            phone: lead.contact.phone ?? undefined,
                          }
                        : undefined
                    }
                    labels={{
                      city: t('partners.leads.city'),
                      message: t('partners.leads.message'),
                      contact: t('partners.leads.contact'),
                      received: t('partners.leads.received'),
                    }}
                    actions={
                      !canAct ? undefined : state === 'offered' ? (
                        <>
                          <form method="post" action={action('accept')}>
                            <Button type="submit" icon="check">
                              {t('partners.leads.accept')}
                            </Button>
                          </form>
                          <form method="post" action={action('decline')}>
                            <Button type="submit" variant="secondary">
                              {t('partners.leads.decline')}
                            </Button>
                          </form>
                        </>
                      ) : state === 'accepted' ? (
                        <form
                          method="post"
                          action={action('outcome')}
                          className="flex w-full flex-col gap-3"
                        >
                          <p className="text-sm font-semibold text-ink">
                            {t('partners.leads.outcome')}
                          </p>
                          <Input
                            label={t('partners.leads.value')}
                            name="value"
                            inputMode="decimal"
                            dir="ltr"
                            maxLength={16}
                          />
                          <div className="flex flex-wrap gap-3">
                            <Button type="submit" name="outcome" value="won" icon="check">
                              {t('partners.leads.won')}
                            </Button>
                            <Button type="submit" name="outcome" value="lost" variant="secondary">
                              {t('partners.leads.lost')}
                            </Button>
                          </div>
                        </form>
                      ) : undefined
                    }
                  />
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </BoardShell>
  )
}
