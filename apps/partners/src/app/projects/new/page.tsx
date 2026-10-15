import type { Metadata } from 'next'
import { randomUUID } from 'node:crypto'
import { ProjectRegistrationForm, type MessageKey } from '@alpha/ui'
import { BoardShell } from '@/components/BoardShell'
import { Notice } from '@/components/Notice'
import { copy, pageLocale } from '@/lib/locale'
import { requirePartner } from '@/lib/session'

type Search = Promise<Record<string, string | string[] | undefined>>

const PROBLEMS = [
  'name',
  'end-customer',
  'expected-close',
  'no-lines',
  'too-many-lines',
  'invalid-quantity',
  'unknown-product',
] as const
const FIELD: Record<(typeof PROBLEMS)[number], string> = {
  name: 'name',
  'end-customer': 'endCustomer',
  'expected-close': 'expectedClose',
  'no-lines': 'lines',
  'too-many-lines': 'lines',
  'invalid-quantity': 'lines',
  'unknown-product': 'lines',
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
const all = (v: string | string[] | undefined) =>
  v === undefined ? [] : Array.isArray(v) ? v : [v]

export async function generateMetadata(): Promise<Metadata> {
  return { title: copy(await pageLocale())('partners.projects.new') }
}

/** Register a project (docs/tasks/0017): a plain form; problems come back with the values kept. */
export default async function NewProjectPage({ searchParams }: { searchParams: Search }) {
  const partner = await requirePartner()
  const params = await searchParams
  const locale = partner.account.user.locale
  const t = copy(locale)
  const problems = (one(params['problems']) ?? '')
    .split(',')
    .filter((p): p is (typeof PROBLEMS)[number] => (PROBLEMS as readonly string[]).includes(p))
  const errors: Record<string, string> = {}
  for (const p of problems) errors[FIELD[p]] ??= t(`partners.projects.problems.${p}`)
  const result = one(params['result'])
  const skus = all(params['sku'])
  const qtys = all(params['qty'])

  return (
    <BoardShell partner={partner} current="projects">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <h1 className="font-display text-3xl font-bold text-ink font-stretch-expanded">
          {t('partners.projects.new')}
        </h1>
        {result === 'not-allowed' || result === 'error' ? (
          <Notice tone="critical">{t(`partners.projects.results.${result}` as MessageKey)}</Notice>
        ) : null}
        <ProjectRegistrationForm
          action="/api/v1/projects"
          hint={t('partners.projects.hint')}
          hidden={{ idempotencyKey: randomUUID() }}
          labels={{
            project: t('partners.projects.project'),
            name: t('partners.projects.name'),
            endCustomer: t('partners.projects.endCustomer'),
            city: t('partners.projects.city'),
            expectedClose: t('partners.projects.expectedClose'),
            note: t('partners.projects.note'),
            products: t('partners.projects.products'),
            line: t('partners.order.line'),
            sku: t('partners.order.sku'),
            qty: t('partners.order.qty'),
            submit: t('partners.projects.submit'),
            required: t('partners.projects.required'),
          }}
          values={{
            name: one(params['name']),
            endCustomer: one(params['endCustomer']),
            city: one(params['city']),
            expectedClose: one(params['expectedClose']),
            note: one(params['note']),
            lines: skus.map((sku, i) => ({ sku, qty: qtys[i] ?? '' })),
          }}
          errors={errors}
          blankRows={skus.length ? 1 : 3}
        />
      </div>
    </BoardShell>
  )
}
