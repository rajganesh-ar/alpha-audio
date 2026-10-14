/**
 * Seeds the six GCC markets into the Markets global. Safe to re-run: it only adds markets that
 * are missing and never overwrites a status, VAT rate or rail changed in the admin.
 *
 *   pnpm --filter @alpha/web seed:markets
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { seedMarkets } from '@alpha/payload'

const payload = await getPayload({ config })
const { added, kept } = await seedMarkets(payload)
payload.logger.info(
  added.length
    ? `Markets seeded: added ${added.join(', ')}${kept.length ? `; kept ${kept.join(', ')}` : ''}.`
    : `Markets already present (${kept.join(', ')}); nothing to add.`,
)
process.exit(0)
