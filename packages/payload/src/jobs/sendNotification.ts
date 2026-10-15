import type { TaskConfig } from 'payload'
import {
  MAX_NOTIFICATION_ATTEMPTS,
  NOTIFICATIONS_QUEUE,
  SEND_NOTIFICATION,
  deliverNotification,
} from '../system/notifications'

export { NOTIFICATIONS_QUEUE, SEND_NOTIFICATION }

/**
 * Sends one customer notification from the outbox (spec: jobs → `sendNotification`). Email only
 * for now, through Payload's email adapter; WhatsApp and SMS by preference arrive with their
 * integrations. Retries with exponential backoff; the outbox row records each attempt.
 */
export const sendNotificationTask: TaskConfig<{
  input: { notification: number }
  output: { result: string }
}> = {
  slug: SEND_NOTIFICATION,
  label: 'Send customer notification',
  inputSchema: [{ name: 'notification', type: 'number', required: true }],
  outputSchema: [{ name: 'result', type: 'text', required: true }],
  retries: {
    attempts: MAX_NOTIFICATION_ATTEMPTS - 1,
    backoff: { type: 'exponential', delay: 30_000 },
  },
  handler: async ({ input, req }) => {
    const result = await deliverNotification(req.payload, input.notification)
    req.payload.logger.info({
      msg: 'notification_delivered',
      notification: input.notification,
      result,
    })
    return { output: { result } }
  },
}

export const NOTIFICATIONS_AUTORUN = { cron: '* * * * *', queue: NOTIFICATIONS_QUEUE } as const
