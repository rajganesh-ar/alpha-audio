import type { Metadata } from 'next'
import { getDictionary, translator } from '@alpha/ui'
import { NotFoundContent } from '@/components/NotFoundContent'
import { marketsForNotFound } from '@/lib/notFoundMarkets'
import './(frontend)/globals.css'

// Reads the Markets record on every 404 (cached in-process), so a newly live market shows up.
export const dynamic = 'force-dynamic'

const en = translator(getDictionary('en'))
const ar = translator(getDictionary('ar'))

export const metadata: Metadata = {
  // Next adds `noindex` to every 404 itself.
  title: `${en('notFound.metaTitle')} · ${ar('notFound.metaTitle')}`,
}

/** Renders for URLs that match no route, and for an unknown or non-live `/{market}/{locale}/`. */
export default async function GlobalNotFound() {
  return (
    <html lang="en" dir="ltr">
      <body>
        <NotFoundContent markets={await marketsForNotFound()} />
      </body>
    </html>
  )
}
