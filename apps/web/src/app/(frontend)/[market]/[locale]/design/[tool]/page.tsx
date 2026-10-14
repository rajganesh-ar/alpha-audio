import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ENTRY_TOOLS, type EntryTool } from '@alpha/payload'
import { Button, EmptyState, getDictionary, translator } from '@alpha/ui'
import { getMarketRoute, requireMarketRoute } from '@/lib/markets'
import { localizedPath } from '@/lib/seo'

type Params = Promise<{ market: string; locale: string; tool: string }>

const isTool = (value: string): value is EntryTool =>
  (ENTRY_TOOLS as readonly string[]).includes(value)

export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { market, locale, tool } = await params
  const route = await getMarketRoute(market, locale)
  if (!route || !isTool(tool)) return {}
  const t = translator(getDictionary(route.locale))
  // Tool pages are never indexed (spec); this placeholder even less.
  return { title: t(`design.tools.${tool}`), robots: { index: false, follow: true } }
}

/** Placeholder for the Advisor, Room Lab and Builder until their tasks land. */
export default async function DesignToolPlaceholder({ params }: { params: Params }) {
  const route = await requireMarketRoute(params)
  const { tool } = await params
  if (!isTool(tool)) notFound()
  const t = translator(getDictionary(route.locale))
  return (
    <div className="mx-auto max-w-2xl py-12">
      <EmptyState
        title={t(`design.tools.${tool}`)}
        body={`${t('design.comingSoon')}. ${t('design.body')}`}
        icon="clock"
        action={
          <Button href={localizedPath(route.market.code, route.locale)} variant="secondary">
            {t('design.back')}
          </Button>
        }
        align="center"
      />
    </div>
  )
}
