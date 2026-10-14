import type { Metadata } from 'next'
import { getDictionary, translator } from '@alpha/ui'
import { NotFoundContent } from '@/components/NotFoundContent'
import { marketsForNotFound } from '@/lib/notFoundMarkets'

const en = translator(getDictionary('en'))
const ar = translator(getDictionary('ar'))

export const metadata: Metadata = {
  title: { absolute: `${en('notFound.metaTitle')} · ${ar('notFound.metaTitle')}` },
}

/**
 * 404 under `/{market}/{locale}/`: an unknown or non-live pair (bare document from the
 * layout), or a page in a valid market that called notFound() (inside the shell).
 */
export default async function MarketNotFound() {
  return <NotFoundContent markets={await marketsForNotFound()} />
}
