import type { Metadata } from 'next'
import Image from 'next/image'
import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { MAX_BAG_LINES, MAX_LINE_QTY, formatMoney, type LineProblem } from '@alpha/core'
import {
  BagLine,
  Button,
  EmptyState,
  OrderSummary,
  Select,
  getDictionary,
  translator,
  type MessageKey,
  type Translate,
} from '@alpha/ui'
import type { MarketRoute } from '@alpha/payload'
import { Notice } from '@/components/commerce/Notice'
import { summaryRows } from '@/components/commerce/summaryRows'
import { viewBag, type BagLineView } from '@/lib/commerce/bag'
import { bagCookie } from '@/lib/commerce/cookies'
import { getMarketRoute, requireMarketRoute } from '@/lib/markets'
import { brandOf, numberLocale, productImages, productPath } from '@/lib/productView'
import { localizedPath } from '@/lib/seo'

// Per-shopper and never cached: it reads the bag cookie or an order's access token, so the
// response is `private, no-store` (CLAUDE.md rule 4).
export const dynamic = 'force-dynamic'

type Params = Promise<{ market: string; locale: string }>
type Search = Promise<Record<string, string | string[] | undefined>>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { market, locale } = await params
  const route = await getMarketRoute(market, locale)
  if (!route) return {}
  return {
    title: translator(getDictionary(route.locale))('bag.metaTitle'),
    robots: { index: false, follow: false },
  }
}

const PROBLEM_KEY: Record<LineProblem, MessageKey> = {
  'not-on-sale': 'bag.notOnSale',
  'price-on-request': 'bag.priceOnRequest',
  'invalid-quantity': 'bag.invalidQuantity',
}

function statusNotice(status: string | undefined, t: Translate) {
  switch (status) {
    case 'added':
      return { tone: 'info' as const, text: t('bag.added') }
    case 'not-on-sale':
      return { tone: 'critical' as const, text: t('bag.notOnSale') }
    case 'full':
      return { tone: 'critical' as const, text: t('bag.full', { max: MAX_BAG_LINES }) }
    case 'error':
      return { tone: 'critical' as const, text: t('bag.error') }
    case 'bag-invalid':
      return { tone: 'critical' as const, text: t('checkout.bagInvalid') }
    default:
      return null
  }
}

/**
 * The bag (docs/tasks/0009). Dynamic and private: it reads the bag cookie and prices every line
 * from the catalogue on each view. Every control is a plain form, so it works without JavaScript.
 */
export default async function BagPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: Search
}) {
  const route = await requireMarketRoute(params)
  const search = await searchParams
  const t = translator(getDictionary(route.locale))
  const token = (await cookies()).get(bagCookie(route.market.code))?.value
  const view = await viewBag(await getPayload({ config }), route, token)
  const locale = numberLocale(route)
  const status = typeof search['status'] === 'string' ? search['status'] : undefined
  const notice = statusNotice(status, t)
  const home = localizedPath(route.market.code, route.locale)

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-3xl font-bold text-ink font-stretch-expanded">
        {t('bag.title')}
      </h1>
      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
      {view.lines.length === 0 ? (
        <EmptyState
          title={t('bag.emptyTitle')}
          body={t('bag.emptyBody')}
          icon="bag"
          action={<Button href={`${home}shop/`}>{t('ui.browseAll')}</Button>}
        />
      ) : (
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="flex flex-col lg:col-span-8">
            {view.lines.map((line) => (
              <BagLineItem key={line.sku} line={line} route={route} t={t} locale={locale} />
            ))}
            <div className="pt-4">
              <Button variant="quiet" href={`${home}shop/`} icon="arrow-forward" iconPosition="end">
                {t('bag.continue')}
              </Button>
            </div>
          </div>
          <aside className="lg:col-span-4">
            <OrderSummary
              title={t('bag.summary')}
              rows={summaryRows(t, view.bag.totals, locale)}
              note={t('bag.deliveryNote')}
              error={view.bag.lines.length === 0 ? t('checkout.bagInvalid') : undefined}
              action={
                view.bag.problems.length === 0 ? (
                  <Button
                    href={localizedPath(route.market.code, route.locale, '/checkout')}
                    fullWidth
                  >
                    {t('bag.checkout')}
                  </Button>
                ) : (
                  <p className="text-sm text-critical">{t('checkout.bagInvalid')}</p>
                )
              }
            />
          </aside>
        </div>
      )}
    </div>
  )
}

const quantities = Array.from({ length: MAX_LINE_QTY }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}))

function BagLineItem({
  line,
  route,
  t,
  locale,
}: {
  line: BagLineView
  route: MarketRoute
  t: Translate
  locale: string
}) {
  const action = `/api/v1/markets/${route.market.code}/bag/lines`
  const product = line.product
  const title = product?.title ?? line.sku
  const image = product ? productImages(product)[0] : undefined
  const hidden = (
    <>
      <input type="hidden" name="sku" value={line.sku} />
      <input type="hidden" name="locale" value={route.locale} />
      <input type="hidden" name="mode" value="set" />
    </>
  )
  return (
    <BagLine
      title={title}
      href={
        product
          ? productPath(route, product.slug)
          : localizedPath(route.market.code, route.locale, '/shop')
      }
      brand={product ? brandOf(product)?.name : undefined}
      media={image ? <Image src={image.url} alt={image.alt} fill sizes="96px" /> : undefined}
      unitPrice={
        line.line ? t('bag.each', { amount: formatMoney(line.line.unitPrice, locale) }) : undefined
      }
      lineTotal={line.line ? formatMoney(line.line.lineTotal, locale) : undefined}
      error={line.problem ? t(PROBLEM_KEY[line.problem], { max: MAX_LINE_QTY }) : undefined}
      notice={
        line.priceChangedFrom
          ? t('bag.priceChanged', { was: formatMoney(line.priceChangedFrom, locale) })
          : undefined
      }
      quantity={
        line.line ? (
          <form method="post" action={action} className="flex items-end gap-2">
            {hidden}
            <Select
              label={t('bag.quantity')}
              name="qty"
              options={quantities}
              defaultValue={String(line.qty)}
            />
            <Button variant="secondary" type="submit">
              {t('bag.update')}
            </Button>
          </form>
        ) : undefined
      }
      remove={
        <form method="post" action={action}>
          {hidden}
          <input type="hidden" name="qty" value="0" />
          <Button variant="quiet" type="submit" icon="close" label={t('bag.removeItem', { title })}>
            {t('bag.remove')}
          </Button>
        </form>
      }
    />
  )
}
