import type { TaskConfig } from 'payload'
import { createLedger } from '../system/ledgerStore'

export const RELEASE_EXPIRED_RESERVATIONS = 'releaseExpiredReservations'
export const LEDGER_QUEUE = 'ledger'

/**
 * Every minute: return expired holds to `available` (carts after 15 minutes, POS after 30,
 * quotes after 7 days, projects on their own date). Safe to overlap: each batch skips
 * reservations another run has locked.
 */
export const releaseExpiredReservationsTask: TaskConfig<{
  input: object
  output: { released: number }
}> = {
  slug: RELEASE_EXPIRED_RESERVATIONS,
  label: 'Release expired reservations',
  schedule: [{ cron: '0 * * * * *', queue: LEDGER_QUEUE }],
  retries: { attempts: 3, backoff: { type: 'exponential', delay: 1_000 } },
  outputSchema: [{ name: 'released', type: 'number', required: true }],
  handler: async ({ req }) => {
    const released = await createLedger(req.payload).releaseExpiredReservations()
    if (released > 0) req.payload.logger.info({ msg: 'reservations_expired', released })
    return { output: { released } }
  },
}
