/**
 * The four legal pages (terms, privacy, returns, warranty) in every market, en and ar, from the
 * draft copy in content/legalPages.ts (docs/tasks/0011). Safe to re-run: existing pages are left
 * alone, so edits made in the admin are never overwritten.
 *
 *   pnpm --filter @alpha/web seed:content
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { MARKET_CODES, ensureStaffUser } from '@alpha/payload'
import { lexicalDocument } from '@/lib/richText'
import { LEGAL_PAGES } from './content/legalPages'

const payload = await getPayload({ config })
const user = await ensureStaffUser(payload, {
  email: 'dev@alpha.local',
  password: 'dev-password-123',
})
const as = () => ({ user, overrideAccess: false, context: { disableRevalidate: true } }) as const

let created = 0
for (const page of LEGAL_PAGES) {
  const existing = await payload.find({
    collection: 'pages',
    where: { slug: { equals: page.slug } },
    draft: true,
    ...as(),
  })
  if (existing.docs.length) continue
  const doc = await payload.create({
    collection: 'pages',
    locale: 'en',
    data: {
      title: page.title.en,
      slug: page.slug,
      kind: 'legal',
      markets: [...MARKET_CODES],
      summary: page.summary.en,
      body: lexicalDocument(page.sections.en) as never,
      arabicReview: 'draft',
      _status: 'published',
    },
    ...as(),
  })
  await payload.update({
    collection: 'pages',
    id: doc.id,
    locale: 'ar',
    data: {
      title: page.title.ar,
      summary: page.summary.ar,
      body: lexicalDocument(page.sections.ar) as never,
      _status: 'published',
    },
    ...as(),
  })
  created++
}
payload.logger.info(
  `Legal pages seeded: ${created} created, ${LEGAL_PAGES.length - created} already there.`,
)
process.exit(0)
