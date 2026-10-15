import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import {
  Button,
  CheckoutSection,
  Input,
  getDictionary,
  translator,
  type MessageKey,
} from '@alpha/ui'
import { Notice } from '@/components/commerce/Notice'
import { customerSession } from '@/lib/account'
import { getMarketRoute, requireMarketRoute } from '@/lib/markets'
import { localizedPath } from '@/lib/seo'

// Per-visitor: reads the session cookie.
export const dynamic = 'force-dynamic'

type Params = Promise<{ market: string; locale: string }>
type Search = Promise<Record<string, string | string[] | undefined>>

const STATUSES = [
  'sent',
  'invalid-email',
  'rate-limited',
  'expired',
  'used',
  'unknown',
  'signed-out',
  'error',
] as const

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { market, locale } = await params
  const route = await getMarketRoute(market, locale)
  if (!route) return {}
  return {
    title: translator(getDictionary(route.locale))('account.metaTitle'),
    robots: { index: false, follow: false },
  }
}

/** My Alpha's door (docs/tasks/0012): signed in goes to orders; otherwise ask for a sign-in link. */
export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: Search
}) {
  const route = await requireMarketRoute(params)
  const status = (await searchParams)['status']
  const { customer } = await customerSession()
  // Signed in with nothing to report: straight to the orders.
  if (customer && !status)
    redirect(localizedPath(route.market.code, route.locale, '/account/orders'))
  const t = translator(getDictionary(route.locale))
  const known =
    typeof status === 'string' && (STATUSES as readonly string[]).includes(status) ? status : null
  const good = known === 'sent' || known === 'signed-out'

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <h1 className="font-display text-3xl font-bold text-ink font-stretch-expanded">
        {t('account.signInTitle')}
      </h1>
      {known ? (
        <Notice tone={good ? 'info' : 'critical'}>
          {t(`account.status.${known}` as MessageKey)}
        </Notice>
      ) : null}
      <CheckoutSection step={1} title={t('account.email')} description={t('account.signInBody')}>
        <form
          method="post"
          action={`/api/v1/markets/${route.market.code}/account/sign-in`}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="locale" value={route.locale} />
          <Input
            label={t('account.email')}
            name="email"
            type="email"
            autoComplete="email"
            dir="ltr"
            required
            maxLength={254}
          />
          <div>
            <Button type="submit" icon="arrow-forward" iconPosition="end">
              {t('account.send')}
            </Button>
          </div>
        </form>
      </CheckoutSection>
    </div>
  )
}
