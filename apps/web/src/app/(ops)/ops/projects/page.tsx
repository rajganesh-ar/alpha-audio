import type { Metadata } from 'next'
import { Button, EmptyState, type MessageKey } from '@alpha/ui'
import { getMarketsCached } from '@alpha/payload'
import type { ProjectRegistration } from '@/payload-types'
import { loginPath, opsCopy, opsDate, staffSession } from '@/lib/ops'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Project registrations' }

const RESULTS = [
  'approved',
  'rejected',
  'not-found',
  'not-submitted',
  'busy',
  'no-prices',
  'invalid-price',
  'forbidden',
]

/** Registrations waiting for review (docs/tasks/0017), oldest first. Staff only. */
export default async function OpsProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const t = opsCopy()
  const { payload, user } = await staffSession()
  if (!user) {
    return (
      <EmptyState
        title={t('ops.signIn')}
        icon="user"
        action={<Button href={loginPath('/ops/projects/')}>{t('ops.signInAction')}</Button>}
      />
    )
  }
  const search = await searchParams
  const result = typeof search['result'] === 'string' ? search['result'] : null
  const { docs } = await payload.find({
    collection: 'project-registrations',
    where: { status: { equals: 'submitted' } },
    sort: 'createdAt',
    limit: 200,
    depth: 1,
    user,
    overrideAccess: false,
  })
  const zones = new Map((await getMarketsCached(payload)).map((m) => [m.code, m.timezone]))
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold text-ink">{t('ops.projects.title')}</h1>
      {result && RESULTS.includes(result) ? (
        <p role="status" className="rounded-card border border-line-strong px-4 py-3 text-ink">
          {t(`ops.projects.results.${result}` as MessageKey, {
            project: typeof search['project'] === 'string' ? search['project'] : '',
          })}
        </p>
      ) : null}
      {docs.length === 0 ? (
        <EmptyState title={t('ops.projects.empty')} icon="check" />
      ) : (
        <table className="w-full border-collapse text-base">
          <thead>
            <tr className="border-b border-line-strong text-sm text-ink-muted">
              {(['number', 'company', 'customer', 'close'] as const).map((c) => (
                <th key={c} scope="col" className="py-2 pe-4 text-start font-semibold">
                  {c === 'number' ? t('ops.columns.number') : t(`ops.projects.${c}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(docs as ProjectRegistration[]).map((p) => (
              <tr key={p.id} className="border-b border-line">
                <td className="py-3 pe-4">
                  <a
                    href={`/ops/projects/${p.number}/`}
                    className="font-mono text-ink underline underline-offset-4"
                  >
                    {p.number}
                  </a>
                  <span className="block text-sm text-ink">{p.name}</span>
                </td>
                <td className="py-3 pe-4 text-ink">
                  {typeof p.company === 'object' ? p.company.name : ''}
                </td>
                <td className="py-3 pe-4 text-ink">{p.endCustomer}</td>
                <td className="py-3 pe-4 text-ink">
                  {opsDate(p.expectedClose, zones.get(p.market) ?? 'UTC')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
