import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import {
  AnnouncementBar,
  AppShell,
  Footer,
  Header,
  MarketSwitch,
  QuietActions,
  getDictionary,
  translator,
} from '@alpha/ui'
import { SuggestedMarketBanner } from '@alpha/ui/suggested-market'
import { languageTag, liveMarkets } from '@alpha/payload'
import { getMarketRoute, getMarkets } from '@/lib/markets'
import { localizedPath, siteUrl } from '@/lib/seo'
import { marketOptions } from '@/lib/shell'
import { getLegalPages } from '@/lib/content'
import { DocumentHead } from '@/components/DocumentHead'
import '../../globals.css'

type Params = Promise<{ market: string; locale: string }>

// Rendered on first request and cached; the Markets hook revalidates on change.
export async function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { market, locale } = await params
  const route = await getMarketRoute(market, locale)
  if (!route) return {}
  const t = translator(getDictionary(route.locale))
  return {
    metadataBase: siteUrl(),
    title: { default: t('shell.brand'), template: `%s · ${t('shell.brand')}` },
  }
}

/**
 * Root layout for the storefront. Sets `html[lang][dir]` from the Markets record and renders
 * the shell. For an unknown, non-live or unsupported market/locale pair it renders a bare
 * document and no shell; the page's requireMarketRoute() then 404s inside it (see lib/markets).
 */
export default async function MarketLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Params
}) {
  const { market, locale } = await params
  const route = await getMarketRoute(market, locale)
  if (!route) {
    return (
      <html lang="en" dir="ltr">
        <head>
          <DocumentHead locale="ar" />
        </head>
        <body>{children}</body>
      </html>
    )
  }

  const markets = await getMarkets()
  const legalPages = await getLegalPages(route.market.code, route.locale)
  const t = translator(getDictionary(route.locale))
  const home = localizedPath(route.market.code, route.locale)
  const marketName = route.market.name[route.locale]

  const targets = liveMarkets(markets)
    .filter((m) => m.code !== route.market.code)
    .map((m) => {
      const targetLocale = m.locales.includes(route.locale)
        ? route.locale
        : (m.locales[0] ?? route.locale)
      return {
        code: m.code,
        href: localizedPath(m.code, targetLocale),
        hrefLang: languageTag(targetLocale, m),
        message: t('suggestedMarket.message', { market: m.name[route.locale] }),
        switchLabel: t('suggestedMarket.switch', { market: m.name[route.locale] }),
      }
    })

  return (
    <html lang={route.languageTag} dir={route.dir}>
      <head>
        <DocumentHead locale={route.locale} />
      </head>
      <body>
        <AppShell
          skipToContentLabel={t('shell.skipToContent')}
          announcement={<AnnouncementBar>{t('announcement.preview')}</AnnouncementBar>}
          banner={
            <SuggestedMarketBanner
              currentMarket={route.market.code}
              targets={targets}
              dismissLabel={t('suggestedMarket.dismiss')}
            />
          }
          header={
            <Header
              homeHref={home}
              brand={t('shell.brand')}
              homeLabel={t('shell.homeLink')}
              navLabel={t('shell.primaryNav')}
              nav={[
                { label: t('shell.nav.products'), href: `${home}shop/` },
                { label: t('shell.nav.brands'), href: `${home}brands/` },
                { label: t('shell.nav.design'), href: `${home}design/advisor/` },
              ]}
              actions={
                <>
                  <QuietActions
                    label={t('ui.quietActions')}
                    actions={[
                      { label: t('ui.search'), icon: 'search', href: `${home}search/` },
                      { label: t('ui.account'), icon: 'user', href: `${home}account/` },
                      { label: t('ui.bag'), icon: 'bag', href: `${home}bag/` },
                    ]}
                  />
                  <MarketSwitch
                    label={t('marketSwitch.label')}
                    currentLabel={t('marketSwitch.current', {
                      market: marketName,
                      language: t(`languages.${route.locale}`),
                    })}
                    options={marketOptions(markets, route)}
                  />
                </>
              }
            />
          }
          footer={
            <Footer
              groups={
                legalPages.length
                  ? [
                      {
                        title: t('footer.legal'),
                        links: legalPages.map((p) => ({
                          label: p.title,
                          href: `${home}legal/${p.slug}/`,
                        })),
                      },
                    ]
                  : []
              }
              copyright={t('footer.copyright', { year: new Date().getUTCFullYear() })}
              pricing={t('footer.pricing', {
                currency: route.market.currency,
                vat: route.market.vatRate,
              })}
            />
          }
        >
          {children}
        </AppShell>
      </body>
    </html>
  )
}
