import type { Metadata } from 'next'
import { Badge, Button } from '@alpha/ui'
import { BoardShell } from '@/components/BoardShell'
import { copy, formatLocale, pageLocale } from '@/lib/locale'
import { PROJECT_TONE, dateTime, projectStateOf } from '@/lib/orderStatus'
import { requirePartner } from '@/lib/session'
import type { ProjectRegistration } from '@/payload-types'

export async function generateMetadata(): Promise<Metadata> {
  return { title: copy(await pageLocale())('partners.projects.title') }
}

/** The company's project registrations, newest first (access scopes them to the company). */
export default async function ProjectsPage() {
  const partner = await requirePartner()
  const { account } = partner
  const locale = account.user.locale
  const t = copy(locale)
  const fmt = formatLocale(locale, account.company.market)
  const projects = await partner.payload.find({
    collection: 'project-registrations',
    user: partner.user as never, // reason: the signed-in company user from payload.auth
    overrideAccess: false,
    depth: 0,
    sort: '-createdAt',
    limit: 100,
  })
  const canRegister = ['owner', 'purchaser'].includes(account.user.role)

  return (
    <BoardShell partner={partner} current="projects">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-3xl font-bold text-ink font-stretch-expanded">
            {t('partners.projects.title')}
          </h1>
          {canRegister ? (
            <Button href="/projects/new" icon="arrow-forward" iconPosition="end">
              {t('partners.projects.new')}
            </Button>
          ) : null}
        </div>
        {projects.docs.length === 0 ? (
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold text-ink">{t('partners.projects.empty')}</p>
            <p className="text-base text-ink-muted">{t('partners.projects.emptyBody')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-base">
              <caption className="sr-only">{t('partners.projects.caption')}</caption>
              <thead>
                <tr className="border-b border-line-strong text-sm text-ink-muted">
                  {(
                    [
                      'partners.projects.number',
                      'partners.projects.name',
                      'partners.projects.endCustomer',
                      'partners.projects.validUntil',
                      'partners.orders.status',
                    ] as const
                  ).map((key) => (
                    <th key={key} scope="col" className="py-2 pe-4 text-start font-semibold">
                      {t(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(projects.docs as ProjectRegistration[]).map((p) => {
                  const state = projectStateOf(p.status, p.validUntil)
                  return (
                    <tr key={p.id} className="border-b border-line align-top">
                      <th scope="row" className="py-3 pe-4 text-start font-normal">
                        <a
                          href={`/projects/${p.number}`}
                          className="inline-flex min-h-11 items-center font-mono font-semibold text-ink underline underline-offset-4"
                        >
                          {p.number}
                        </a>
                      </th>
                      <td className="py-3 pe-4 text-ink">{p.name}</td>
                      <td className="py-3 pe-4 text-ink">{p.endCustomer}</td>
                      <td className="py-3 pe-4 text-ink">
                        {p.validUntil ? dateTime(p.validUntil, fmt, account.timezone) : '—'}
                      </td>
                      <td className="py-3 pe-4">
                        <Badge
                          label={t(`partners.projects.statuses.${state}`)}
                          tone={PROJECT_TONE[state]}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </BoardShell>
  )
}
