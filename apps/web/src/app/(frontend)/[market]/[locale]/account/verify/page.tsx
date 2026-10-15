import type { Metadata } from 'next'
import { Button, getDictionary, translator } from '@alpha/ui'
import { getMarketRoute, requireMarketRoute } from '@/lib/markets'

export const dynamic = 'force-dynamic'

type Params = Promise<{ market: string; locale: string }>
type Search = Promise<Record<string, string | string[] | undefined>>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { market, locale } = await params
  const route = await getMarketRoute(market, locale)
  if (!route) return {}
  return {
    title: translator(getDictionary(route.locale))('account.verifyTitle'),
    robots: { index: false, follow: false },
    // The token in this URL must not leak to other sites.
    referrer: 'same-origin',
  }
}

/**
 * Where the emailed link lands (docs/tasks/0012). Opening it does nothing: mail scanners open
 * links too. The shopper presses Sign in, which posts the token and starts the session.
 */
export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: Search
}) {
  const route = await requireMarketRoute(params)
  const token = (await searchParams)['token']
  const t = translator(getDictionary(route.locale))
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <h1 className="font-display text-3xl font-bold text-ink font-stretch-expanded">
        {t('account.verifyTitle')}
      </h1>
      <p className="text-lg text-ink-muted">{t('account.verifyBody')}</p>
      <form method="post" action={`/api/v1/markets/${route.market.code}/account/verify`}>
        <input type="hidden" name="locale" value={route.locale} />
        <input type="hidden" name="token" value={typeof token === 'string' ? token : ''} />
        <Button type="submit" icon="user">
          {t('account.verify')}
        </Button>
      </form>
    </div>
  )
}
