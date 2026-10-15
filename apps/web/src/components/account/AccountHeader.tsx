import type { MarketRoute } from '@alpha/payload'
import { AccountTabs, Button, getDictionary, translator } from '@alpha/ui'
import type { SignedInCustomer } from '@/lib/account'
import { localizedPath } from '@/lib/seo'

/** My Alpha's title, sections and sign-out form (with the session's CSRF token). */
export function AccountHeader({
  route,
  customer,
  csrf,
  current,
}: {
  route: MarketRoute
  customer: SignedInCustomer
  csrf: string | null
  current: 'orders'
}) {
  const t = translator(getDictionary(route.locale))
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-3xl font-bold text-ink font-stretch-expanded">
        {t('account.title')}
      </h1>
      <AccountTabs
        label={t('account.nav')}
        tabs={[
          {
            label: t('account.orders'),
            href: localizedPath(route.market.code, route.locale, '/account/orders'),
            current: current === 'orders',
          },
        ]}
        identity={customer.email}
        signOut={
          <form method="post" action={`/api/v1/markets/${route.market.code}/account/sign-out`}>
            <input type="hidden" name="locale" value={route.locale} />
            <input type="hidden" name="csrf" value={csrf ?? ''} />
            <Button type="submit" variant="secondary">
              {t('account.signOut')}
            </Button>
          </form>
        }
      />
    </div>
  )
}
