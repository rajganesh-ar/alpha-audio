import type { TaskConfig } from 'payload'
import { LEADS_QUEUE, ROUTE_LEAD, rerouteExpiredLeads, routeLead } from '../system/leads'

export { LEADS_QUEUE, ROUTE_LEAD }
export const REROUTE_EXPIRED_LEADS = 'rerouteExpiredLeads'

/**
 * Routes one lead and emails the company it is offered to (spec: jobs → `routeLead`). Queued when
 * a lead is created, declined or its offer expires; idempotent (only one run moves a lead out of
 * `new`).
 */
export const routeLeadTask: TaskConfig<{ input: { lead: string }; output: { result: string } }> = {
  slug: ROUTE_LEAD,
  label: 'Route a lead',
  inputSchema: [{ name: 'lead', type: 'text', required: true }],
  outputSchema: [{ name: 'result', type: 'text', required: true }],
  retries: { attempts: 4, backoff: { type: 'exponential', delay: 10_000 } },
  handler: async ({ input, req }) => ({
    output: { result: await routeLead(req.payload, input.lead) },
  }),
}

/** Every 5 minutes: offers past their 24-hour deadline go to the next company. */
export const rerouteExpiredLeadsTask: TaskConfig<{ input: object; output: { expired: number } }> = {
  slug: REROUTE_EXPIRED_LEADS,
  label: 'Re-route unanswered leads',
  schedule: [{ cron: '0 */5 * * * *', queue: LEADS_QUEUE }],
  retries: { attempts: 3, backoff: { type: 'exponential', delay: 5_000 } },
  outputSchema: [{ name: 'expired', type: 'number', required: true }],
  handler: async ({ req }) => ({ output: { expired: await rerouteExpiredLeads(req.payload) } }),
}

export const LEADS_AUTORUN = { cron: '* * * * *', queue: LEADS_QUEUE } as const
