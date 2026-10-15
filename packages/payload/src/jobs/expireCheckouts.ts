import type { TaskConfig } from 'payload'
import type { PaymentProvider } from '@alpha/core'
import { createCheckout } from '../system/checkoutStore'
import { LEDGER_QUEUE } from './releaseExpiredReservations'

export const EXPIRE_CHECKOUTS = 'expireCheckouts'

/** Expiry never opens a payment; a provider that refuses to is enough. */
const noPayments: PaymentProvider = {
  id: 'none',
  methods: [],
  createPayment: () => Promise.reject(new Error('expireCheckouts never creates payments')),
  parseWebhook: () => null,
}

/**
 * Every minute: orders still paying after their 15-minute holds lapsed become `expired` and
 * their holds are released (docs/tasks/0009). A late capture can still revive one.
 */
export const expireCheckoutsTask: TaskConfig<{ input: object; output: { expired: number } }> = {
  slug: EXPIRE_CHECKOUTS,
  label: 'Expire unpaid checkouts',
  schedule: [{ cron: '30 * * * * *', queue: LEDGER_QUEUE }],
  retries: { attempts: 3, backoff: { type: 'exponential', delay: 1_000 } },
  outputSchema: [{ name: 'expired', type: 'number', required: true }],
  handler: async ({ req }) => {
    const expired = await createCheckout(req.payload, noPayments).expire()
    if (expired > 0) req.payload.logger.info({ msg: 'checkouts_expired', expired })
    return { output: { expired } }
  },
}
