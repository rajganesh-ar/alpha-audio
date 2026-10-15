import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AppShell, Button, CompanyHeader, Input, type MessageKey } from '@alpha/ui'
import { Notice } from '@/components/Notice'
import { copy, pageLocale } from '@/lib/locale'
import { currentPartner } from '@/lib/session'

type Search = Promise<Record<string, string | string[] | undefined>>

const STATUSES = ['invalid', 'locked', 'missing', 'cross-site', 'signed-out', 'error'] as const

export async function generateMetadata(): Promise<Metadata> {
  return { title: copy(await pageLocale())('partners.signIn.title') }
}

/** Dealer sign-in (docs/tasks/0014): a plain form, so it works without JavaScript. */
export default async function LoginPage({ searchParams }: { searchParams: Search }) {
  const status = (await searchParams)['status']
  if ((await currentPartner()) && !status) redirect('/catalogue')
  const t = copy(await pageLocale())
  const known =
    typeof status === 'string' && (STATUSES as readonly string[]).includes(status) ? status : null
  return (
    <AppShell
      skipToContentLabel={t('shell.skipToContent')}
      header={
        <CompanyHeader
          brand={t('partners.brand')}
          homeHref="/login"
          navLabel={t('shell.primaryNav')}
          nav={[]}
        />
      }
      footer={null}
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <h1 className="font-display text-3xl font-bold text-ink font-stretch-expanded">
          {t('partners.signIn.title')}
        </h1>
        <p className="text-base text-ink-muted">{t('partners.signIn.body')}</p>
        {known ? (
          <Notice tone={known === 'signed-out' ? 'info' : 'critical'}>
            {t(`partners.signIn.status.${known}` as MessageKey)}
          </Notice>
        ) : null}
        <form method="post" action="/api/v1/session" className="flex flex-col gap-4">
          <Input
            label={t('partners.signIn.email')}
            name="email"
            type="email"
            autoComplete="username"
            dir="ltr"
            required
            maxLength={254}
          />
          <Input
            label={t('partners.signIn.password')}
            name="password"
            type="password"
            autoComplete="current-password"
            dir="ltr"
            required
            maxLength={256}
          />
          <div>
            <Button type="submit" icon="arrow-forward" iconPosition="end">
              {t('partners.signIn.submit')}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  )
}
