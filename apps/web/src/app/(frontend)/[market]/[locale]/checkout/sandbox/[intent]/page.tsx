import type { Metadata } from 'next'
import { formatMoney } from '@alpha/core'
import { SandboxPaymentProvider } from '@alpha/payload'
import { Button, ErrorState, getDictionary, translator } from '@alpha/ui'
import { paymentProvider } from '@/lib/commerce/payments'
import { getMarketRoute, requireMarketRoute } from '@/lib/markets'
import { numberLocale } from '@/lib/productView'

// Per-shopper and never cached: it reads the bag cookie or an order's access token, so the
// response is `private, no-store` (CLAUDE.md rule 4).
export const dynamic = 'force-dynamic'

type Params = Promise<{ market: string; locale: string; intent: string }>
type Search = Promise<Record<string, string | string[] | undefined>>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { market, locale } = await params
  const route = await getMarketRoute(market, locale)
  if (!route) return {}
  return {
    title: translator(getDictionary(route.locale))('checkout.sandbox.metaTitle'),
    robots: { index: false, follow: false },
  }
}

/**
 * The sandbox provider's hosted payment page (docs/tasks/0009): plays the card gateway in
 * development and staging. It reads only what its signed link says; Pay and Decline post to the
 * sandbox handler, which signs the event and delivers it to the webhook.
 */
export default async function SandboxPaymentPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: Search
}) {
  const route = await requireMarketRoute(params)
  const { intent: intentId } = await params
  const t = translator(getDictionary(route.locale))
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams))
    for (const v of typeof value === 'string' ? [value] : (value ?? [])) query.append(key, v)
  const provider = paymentProvider()
  const intent =
    provider instanceof SandboxPaymentProvider ? provider.readIntent(intentId, query) : null

  if (!intent) {
    return <ErrorState title={t('checkout.sandbox.title')} body={t('checkout.sandbox.invalid')} />
  }
  const action = `/api/v1/markets/${route.market.code}/checkout/sandbox/${encodeURIComponent(intentId)}`
  return (
    <section className="mx-auto flex max-w-lg flex-col gap-6 rounded-card border border-line-strong p-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold text-ink">{t('checkout.sandbox.title')}</h1>
        <p className="text-base text-ink-muted">{t('checkout.sandbox.body')}</p>
      </div>
      <p className="text-lg text-ink">
        {t('checkout.sandbox.order', { number: intent.orderNumber })}
      </p>
      <form method="post" action={action} className="flex flex-wrap gap-3">
        <input type="hidden" name="q" value={query.toString()} />
        <Button type="submit" name="action" value="pay">
          {t('checkout.sandbox.pay', { amount: formatMoney(intent.amount, numberLocale(route)) })}
        </Button>
        <Button type="submit" name="action" value="decline" variant="secondary" tone="critical">
          {t('checkout.sandbox.decline')}
        </Button>
      </form>
    </section>
  )
}
