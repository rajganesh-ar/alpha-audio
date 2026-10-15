import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { Breadcrumb, getDictionary, translator } from '@alpha/ui'
import { RichTextView } from '@/components/RichTextView'
import { getLegalPage, publishedInMarket } from '@/lib/content'
import { getMarketRoute, getMarkets, requireMarketRoute } from '@/lib/markets'
import { numberLocale } from '@/lib/productView'
import { headingsOf } from '@/lib/richText'
import { alternatesFor, localizedPath } from '@/lib/seo'

type Params = Promise<{ market: string; locale: string; slug: string }>

// ISR: expired by the Pages hook on publish (`content` tag), at most five minutes old otherwise.
export const revalidate = 300
export async function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { market, locale, slug } = await params
  const route = await getMarketRoute(market, locale)
  if (!route) return {}
  const page = await getLegalPage(slug, route.locale)
  if (!page || !publishedInMarket(page, route.market.code)) return {}
  return {
    title: page.seo?.title || page.title,
    description: page.seo?.description || page.summary || undefined,
    alternates: alternatesFor(await getMarkets(), route, `/legal/${page.slug}`, (m) =>
      publishedInMarket(page, m.code),
    ),
  }
}

/** A legal page (docs/tasks/0011): terms, privacy, returns, warranty. 404 where not published. */
export default async function LegalPage({ params }: { params: Params }) {
  const route = await requireMarketRoute(params)
  const { slug } = await params
  const page = await getLegalPage(slug, route.locale)
  if (!page || !publishedInMarket(page, route.market.code)) notFound()
  const t = translator(getDictionary(route.locale))
  const sections = headingsOf(page.body)
  const reviewed = page.reviewedAt
    ? new Intl.DateTimeFormat(numberLocale(route), {
        dateStyle: 'long',
        timeZone: route.market.timezone,
      }).format(new Date(page.reviewedAt))
    : null

  return (
    <article className="flex flex-col gap-8">
      <Breadcrumb
        label={t('ui.breadcrumb')}
        items={[
          { label: t('ui.home'), href: localizedPath(route.market.code, route.locale) },
          { label: page.title },
        ]}
      />
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold text-ink font-stretch-expanded">
          {page.title}
        </h1>
        {page.summary ? <p className="max-w-prose text-lg text-ink-muted">{page.summary}</p> : null}
        {reviewed ? (
          <p className="text-sm text-ink-muted">{t('legal.reviewed', { date: reviewed })}</p>
        ) : null}
      </header>
      <div className="grid gap-8 lg:grid-cols-12">
        {sections.length > 1 ? (
          <nav aria-label={t('legal.contents')} className="lg:col-span-3">
            <h2 className="mb-2 text-sm font-semibold text-ink-muted">{t('legal.contents')}</h2>
            <ol className="m-0 flex list-none flex-col gap-1 p-0">
              {sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="inline-flex min-h-11 items-center text-base text-ink underline-offset-4 hover:underline"
                  >
                    {s.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <div className={sections.length > 1 ? 'lg:col-span-9' : 'lg:col-span-12'}>
          <RichTextView data={page.body as SerializedEditorState} />
        </div>
      </div>
    </article>
  )
}
