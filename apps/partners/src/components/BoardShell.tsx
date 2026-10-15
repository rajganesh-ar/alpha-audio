import type { ReactNode } from 'react'
import { formatMoney } from '@alpha/core'
import { AppShell, Button, CompanyHeader } from '@alpha/ui'
import { copy, formatLocale } from '@/lib/locale'
import type { Partner } from '@/lib/session'

/** The signed-in frame: company header (tier, credit, hold) with sign-out, then the page. */
export function BoardShell({
  partner,
  current,
  children,
}: {
  partner: Partner
  current: 'catalogue' | 'orders' | 'quotes' | 'projects' | 'leads'
  children: ReactNode
}) {
  const { account } = partner
  const locale = account.user.locale
  const t = copy(locale)
  return (
    <AppShell
      skipToContentLabel={t('shell.skipToContent')}
      header={
        <CompanyHeader
          brand={t('partners.brand')}
          homeHref="/catalogue"
          navLabel={t('shell.primaryNav')}
          nav={[
            {
              label: t('partners.nav.catalogue'),
              href: '/catalogue',
              current: current === 'catalogue',
            },
            { label: t('partners.nav.orders'), href: '/orders', current: current === 'orders' },
            { label: t('partners.nav.quotes'), href: '/quotes', current: current === 'quotes' },
            {
              label: t('partners.nav.projects'),
              href: '/projects',
              current: current === 'projects',
            },
            { label: t('partners.nav.leads'), href: '/leads', current: current === 'leads' },
          ]}
          company={account.company.name}
          tier={
            (['gold', 'silver', 'standard'] as const).includes(
              account.company.tier as 'gold' | 'silver' | 'standard',
            )
              ? t(`partners.tier.${account.company.tier as 'gold' | 'silver' | 'standard'}`)
              : undefined
          }
          credit={
            account.creditLimit
              ? t('partners.credit', {
                  amount: formatMoney(
                    account.creditLimit,
                    formatLocale(locale, account.company.market),
                  ),
                })
              : undefined
          }
          notice={account.hold ? t('partners.hold') : undefined}
          signOut={
            <form method="post" action="/api/v1/session/sign-out">
              <Button type="submit" variant="secondary">
                {t('partners.signOut')}
              </Button>
            </form>
          }
        />
      }
      footer={null}
    >
      {children}
    </AppShell>
  )
}
