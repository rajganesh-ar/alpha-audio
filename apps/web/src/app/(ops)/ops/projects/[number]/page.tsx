import type { Metadata } from 'next'
import { Button, EmptyState, Input, type MessageKey } from '@alpha/ui'
import { getMarketsCached } from '@alpha/payload'
import type { ProjectRegistration } from '@/payload-types'
import { loginPath, opsCopy, opsDate, staffSession } from '@/lib/ops'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Project registration' }

/** Review one registration: a project price per line, the validity and a note. Staff only. */
export default async function OpsProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const t = opsCopy()
  const { number } = await params
  const { payload, user } = await staffSession()
  if (!user) {
    return (
      <EmptyState
        title={t('ops.signIn')}
        icon="user"
        action={
          <Button href={loginPath(`/ops/projects/${number}/`)}>{t('ops.signInAction')}</Button>
        }
      />
    )
  }
  const search = await searchParams
  const result = typeof search['result'] === 'string' ? search['result'] : null
  const { docs } = await payload.find({
    collection: 'project-registrations',
    where: { number: { equals: number } },
    depth: 1,
    limit: 1,
    user,
    overrideAccess: false,
  })
  const project = docs[0] as ProjectRegistration | undefined
  if (!project) return <EmptyState title={t('ops.projects.results.not-found')} icon="search" />
  const market = (await getMarketsCached(payload)).find((m) => m.code === project.market)
  const company = typeof project.company === 'object' ? project.company : null
  return (
    <div className="flex flex-col gap-6">
      <a href="/ops/projects/" className="text-sm text-ink underline underline-offset-4">
        {t('ops.projects.title')}
      </a>
      <h1 className="font-display text-3xl font-bold text-ink">
        {project.name} <span className="font-mono text-xl">{project.number}</span>
      </h1>
      {result ? (
        <p role="alert" className="rounded-card border border-critical px-4 py-3 text-critical">
          {t(
            `ops.projects.results.${result === 'invalid-price' ? 'invalid-price' : 'invalid'}` as MessageKey,
          )}
        </p>
      ) : null}
      <p className="text-ink">
        {company?.name ?? ''} · {project.endCustomer} · {project.city ?? ''} ·{' '}
        {opsDate(project.expectedClose, market?.timezone ?? 'UTC')} · {project.status}
      </p>
      {project.note ? <p className="text-ink">{project.note}</p> : null}
      <form
        method="post"
        action={`/api/v1/ops/projects/${encodeURIComponent(project.number)}/decide`}
        className="flex flex-col gap-4"
      >
        <table className="w-full border-collapse text-base">
          <thead>
            <tr className="border-b border-line-strong text-sm text-ink-muted">
              <th scope="col" className="py-2 pe-4 text-start font-semibold">
                {t('ops.sku')}
              </th>
              <th scope="col" className="py-2 pe-4 text-end font-semibold">
                {t('ops.qty')}
              </th>
              <th scope="col" className="py-2 text-start font-semibold">
                {t('ops.projects.price', { currency: market?.currency ?? '' })}
              </th>
            </tr>
          </thead>
          <tbody>
            {(project.lines ?? []).map((l) => (
              <tr key={l.id ?? l.sku} className="border-b border-line align-top">
                <td className="py-2 pe-4 text-ink">
                  <span className="block font-mono">{l.sku}</span>
                  <span className="block text-sm text-ink-muted">{l.title}</span>
                </td>
                <td className="py-2 pe-4 text-end text-ink tabular-nums">{l.qty}</td>
                <td className="py-2">
                  <Input
                    label={t('ops.projects.price', { currency: market?.currency ?? '' })}
                    name={`price:${l.sku}`}
                    inputMode="decimal"
                    dir="ltr"
                    maxLength={16}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('ops.projects.validity')}
            name="validityDays"
            type="number"
            defaultValue="90"
            dir="ltr"
          />
          <Input label={t('ops.projects.note')} name="note" maxLength={500} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" name="decision" value="approve" icon="check">
            {t('ops.projects.approve')}
          </Button>
          <Button type="submit" name="decision" value="reject" variant="secondary" tone="critical">
            {t('ops.projects.reject')}
          </Button>
        </div>
      </form>
    </div>
  )
}
