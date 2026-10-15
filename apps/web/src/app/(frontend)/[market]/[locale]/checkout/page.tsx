import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  ADDRESS_SCHEME_FIELDS,
  formatMoney,
  isAddressScheme,
  validateDetails,
  type AddressFieldSpec,
  type FieldProblem,
} from '@alpha/core'
import {
  Button,
  CheckoutSection,
  Input,
  OrderSummary,
  PaymentMethodList,
  getDictionary,
  translator,
  type MessageKey,
  type Translate,
} from '@alpha/ui'
import { Notice } from '@/components/commerce/Notice'
import { summaryRows } from '@/components/commerce/summaryRows'
import { checkoutPaths, defaultProvider, offeredMethods } from '@/lib/api/checkout'
import { customerSession } from '@/lib/account'
import { viewBag } from '@/lib/commerce/bag'
import { bagCookie } from '@/lib/commerce/cookies'
import { newFormKey } from '@/lib/commerce/tokens'
import { getMarketRoute, requireMarketRoute } from '@/lib/markets'
import { numberLocale } from '@/lib/productView'

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
    title: translator(getDictionary(route.locale))('checkout.metaTitle'),
    robots: { index: false, follow: false },
  }
}

const STATUS_KEY: Record<string, MessageKey> = {
  invalid: 'checkout.errorsTitle',
  expired: 'checkout.expired',
  'payment-error': 'checkout.paymentError',
  'already-closed': 'checkout.alreadyClosed',
  'no-payments': 'checkout.noMethods',
}

const list = (value: string | string[] | undefined): string[] =>
  value === undefined ? [] : typeof value === 'string' ? [value] : value

/**
 * One-page checkout (docs/tasks/0009): contact, the address fields of the market's scheme, the
 * market's payment rails the provider takes, and the summary. A plain form posted to
 * `/api/v1/markets/{m}/checkout`; on a refusal the handler returns here with the draft saved.
 */
export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: Search
}) {
  const route = await requireMarketRoute(params)
  const search = await searchParams
  const t = translator(getDictionary(route.locale))
  const paths = checkoutPaths(route)
  const token = (await cookies()).get(bagCookie(route.market.code))?.value
  const view = await viewBag(await getPayload({ config }), route, token)
  if (!view.cart || view.lines.length === 0) redirect(paths.bag)
  if (view.bag.problems.length) redirect(`${paths.bag}?status=bag-invalid`)

  const locale = numberLocale(route)
  const draft = view.cart.draft
  // A signed-in customer starts with their details (docs/tasks/0012); the draft wins once typed.
  const { customer } = await customerSession()
  const known: Record<string, string> = customer
    ? { email: customer.email, name: customer.name ?? '', phone: customer.phone ?? '' }
    : {}
  const value = (name: string) =>
    typeof draft[name] === 'string' ? (draft[name] as string) : (known[name] ?? '')
  const status = typeof search['status'] === 'string' ? search['status'] : undefined
  const scheme = isAddressScheme(route.market.addressScheme) ? route.market.addressScheme : null
  const methods = offeredMethods(route, defaultProvider(route))
  const canPay = scheme !== null && methods.length > 0

  const errors: Partial<Record<string, FieldProblem>> =
    status === 'invalid' && scheme
      ? (() => {
          const result = validateDetails(scheme, draft)
          return result.ok ? {} : result.errors
        })()
      : {}
  const methodError = status === 'invalid' && !methods.includes(value('method'))
  const problemText = (name: string) =>
    errors[name] ? t(`checkout.problem.${errors[name]}` as MessageKey) : undefined

  const unavailable = list(search['sku'])
    .map((sku) => view.catalog.get(sku)?.product.title ?? sku)
    .join(', ')
  const notice =
    status === 'unavailable'
      ? t('checkout.unavailable', { items: unavailable })
      : status && STATUS_KEY[status]
        ? t(STATUS_KEY[status])
        : !canPay
          ? t('checkout.noMethods')
          : null

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold text-ink font-stretch-expanded">
          {t('checkout.title')}
        </h1>
        <p>
          <a href={paths.bag} className="text-base text-ink underline underline-offset-4">
            {t('checkout.back')}
          </a>
        </p>
      </div>
      {notice ? <Notice tone="critical">{notice}</Notice> : null}
      <form
        method="post"
        action={`/api/v1/markets/${route.market.code}/checkout`}
        className="grid gap-8 lg:grid-cols-12"
      >
        <input type="hidden" name="locale" value={route.locale} />
        <input type="hidden" name="key" value={newFormKey()} />
        <div className="flex flex-col gap-6 lg:col-span-8">
          <CheckoutSection
            step={1}
            title={t('checkout.contact')}
            description={t('checkout.contactBody')}
          >
            <Input
              label={t('checkout.name')}
              name="name"
              autoComplete="name"
              required
              maxLength={120}
              defaultValue={value('name')}
              error={problemText('name')}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={t('checkout.email')}
                name="email"
                type="email"
                dir="ltr"
                autoComplete="email"
                required
                maxLength={254}
                defaultValue={value('email')}
                error={problemText('email')}
              />
              <Input
                label={t('checkout.phone')}
                name="phone"
                type="tel"
                dir="ltr"
                autoComplete="tel"
                required
                maxLength={20}
                defaultValue={value('phone')}
                error={problemText('phone')}
              />
            </div>
          </CheckoutSection>
          <CheckoutSection
            step={2}
            title={t('checkout.delivery')}
            description={t('checkout.deliveryBody')}
          >
            {scheme ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {(ADDRESS_SCHEME_FIELDS[scheme] as readonly AddressFieldSpec[]).map((field) => (
                  <div
                    key={field.name}
                    className={field.name === 'notes' ? 'sm:col-span-2' : undefined}
                  >
                    <AddressInput
                      field={field}
                      t={t}
                      value={value(field.name)}
                      error={problemText(field.name)}
                    />
                  </div>
                ))}
              </div>
            ) : undefined}
          </CheckoutSection>
          <CheckoutSection
            step={3}
            title={t('checkout.payment')}
            description={canPay ? t('checkout.paymentBody') : undefined}
            emptyLabel={t('checkout.noMethods')}
          >
            {canPay ? (
              <PaymentMethodList
                label={t('checkout.methods.label')}
                name="method"
                value={methods.includes(value('method')) ? value('method') : undefined}
                options={methods.map((m) => ({
                  value: m,
                  label: t(`checkout.methods.${m}` as MessageKey),
                  ...(m === 'card' ? { description: t('checkout.methods.card_description') } : {}),
                }))}
                error={methodError ? t('checkout.problem.required') : undefined}
              />
            ) : undefined}
          </CheckoutSection>
        </div>
        <aside className="lg:col-span-4">
          <OrderSummary
            title={t('bag.summary')}
            rows={summaryRows(t, view.bag.totals, locale)}
            note={t('checkout.holdNote')}
            action={
              canPay ? (
                <Button type="submit" fullWidth>
                  {t('checkout.pay', { amount: formatMoney(view.bag.totals.total, locale) })}
                </Button>
              ) : undefined
            }
          />
          <ul className="mt-4 flex flex-col gap-1 text-sm text-ink-muted">
            {view.bag.lines.map((line) => (
              <li key={line.sku} className="flex justify-between gap-4">
                <span>
                  {line.qty} × {line.title}
                </span>
                <bdi className="tabular-nums">{formatMoney(line.lineTotal, locale)}</bdi>
              </li>
            ))}
          </ul>
        </aside>
      </form>
    </div>
  )
}

function AddressInput({
  field,
  t,
  value,
  error,
}: {
  field: AddressFieldSpec
  t: Translate
  value: string
  error: string | undefined
}) {
  return (
    <Input
      label={t(`checkout.address.${field.name}` as MessageKey)}
      name={field.name}
      required={field.required}
      maxLength={field.maxLength}
      inputMode={field.inputMode}
      autoComplete={field.autoComplete}
      dir={field.inputMode === 'numeric' ? 'ltr' : undefined}
      defaultValue={value}
      error={error}
    />
  )
}
