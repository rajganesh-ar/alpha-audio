import type { Metadata } from 'next'
import { randomUUID } from 'node:crypto'
import { notFound } from 'next/navigation'
import { Button, Input, getDictionary, translator, type MessageKey } from '@alpha/ui'
import { Notice } from '@/components/commerce/Notice'
import { getProduct } from '@/lib/catalog'
import { getMarketRoute, requireMarketRoute } from '@/lib/markets'
import { getSaleRule } from '@/lib/rights'

// Per visitor (a fresh form key each time); `noindex`, and robots.txt disallows /enquire/.
export const dynamic = 'force-dynamic'

type Params = Promise<{ market: string; locale: string }>
type Search = Promise<Record<string, string | string[] | undefined>>

const STATUSES = ['sent', 'rate-limited', 'not-found', 'invalid'] as const
const FIELDS = ['name', 'email', 'phone', 'consent', 'form'] as const
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params
  searchParams: Search
}): Promise<Metadata> {
  const { market, locale } = await params
  const route = await getMarketRoute(market, locale)
  if (!route) return {}
  const product = await getProduct(one((await searchParams)['product']) ?? '', route.locale)
  return {
    title: translator(getDictionary(route.locale))('enquiry.metaTitle', {
      product: product?.title ?? '',
    }),
    robots: { index: false, follow: false },
  }
}

/**
 * Ask about a product (docs/tasks/0018): a plain form that becomes a lead, routed to Alpha or a
 * partner by the brand's agreement. Works without JavaScript; the shopper's details never go in
 * a URL.
 */
export default async function EnquirePage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: Search
}) {
  const route = await requireMarketRoute(params)
  const search = await searchParams
  const slug = one(search['product']) ?? ''
  const product = slug ? await getProduct(slug, route.locale) : null
  const onSale = await getSaleRule()
  if (!product || !onSale(product, route.market.code)) notFound()

  const t = translator(getDictionary(route.locale))
  const status = one(search['status'])
  const known = status && (STATUSES as readonly string[]).includes(status) ? status : null
  const problems = new Set(
    (one(search['fields']) ?? '')
      .split(',')
      .filter((f) => (FIELDS as readonly string[]).includes(f)),
  )
  const error = (field: (typeof FIELDS)[number]) =>
    problems.has(field) ? t(`enquiry.fields.${field}`) : undefined

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <h1 className="font-display text-3xl font-bold text-ink font-stretch-expanded">
        {t('enquiry.title', { product: product.title })}
      </h1>
      <p className="text-base text-ink-muted">{t('enquiry.body')}</p>
      {known ? (
        <Notice tone={known === 'sent' ? 'info' : 'critical'}>
          {t(`enquiry.status.${known}` as MessageKey)}
        </Notice>
      ) : null}
      {problems.has('form') ? <Notice tone="critical">{t('enquiry.fields.form')}</Notice> : null}
      {known === 'sent' ? null : (
        <form
          method="post"
          action={`/api/v1/markets/${route.market.code}/leads`}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="product" value={product.slug} />
          <input type="hidden" name="locale" value={route.locale} />
          <input type="hidden" name="key" value={randomUUID()} />
          <Input
            label={t('enquiry.name')}
            name="name"
            autoComplete="name"
            required
            requiredLabel={t('enquiry.required')}
            maxLength={120}
            error={error('name')}
          />
          <Input
            label={t('enquiry.email')}
            name="email"
            type="email"
            autoComplete="email"
            dir="ltr"
            required
            requiredLabel={t('enquiry.required')}
            maxLength={254}
            error={error('email')}
          />
          <Input
            label={t('enquiry.phone')}
            name="phone"
            type="tel"
            autoComplete="tel"
            dir="ltr"
            maxLength={30}
            error={error('phone')}
          />
          <Input
            label={t('enquiry.city')}
            name="city"
            autoComplete="address-level2"
            maxLength={80}
          />
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-ink">{t('enquiry.message')}</span>
            <textarea
              name="message"
              rows={4}
              maxLength={2000}
              className="w-full rounded-control border border-line-strong bg-transparent px-3 py-2 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            />
          </label>
          {/* Honeypot: hidden from people and assistive technology; bots fill it in. */}
          <div aria-hidden="true" className="absolute -start-[9999px] h-px w-px overflow-hidden">
            <label>
              {t('enquiry.honeypot')}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <label className="flex min-h-11 items-start gap-3 text-base text-ink">
            <input
              type="checkbox"
              name="consent"
              required
              aria-invalid={problems.has('consent') || undefined}
              className="mt-1 size-5 shrink-0 accent-lacquer"
            />
            <span>{t('enquiry.consent')}</span>
          </label>
          {error('consent') ? <p className="text-sm text-critical">{error('consent')}</p> : null}
          <div>
            <Button type="submit" icon="arrow-forward" iconPosition="end">
              {t('enquiry.send')}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
