import type { Payload } from 'payload'
import { z } from 'zod'
import type { FulfilmentResult, PaymentProvider } from '@alpha/core'
import { createFulfilment } from '@alpha/payload'
import { paymentProvider } from '@/lib/commerce/payments'
import { isForm, readFields, seeOther, withQuery } from './forms'
import { json, problem, requireStaff } from './respond'

/**
 * Ops endpoints for order fulfilment (docs/tasks/0010):
 * `POST /api/v1/ops/orders/{number}/{pick|ship|deliver|cancel|refund}`. Staff only (Payload
 * session), same-origin. Thin: validate, call `FulfilmentService`, map its answer. The ops
 * screens post plain forms and get `303` back to the order; scripts send JSON.
 */

export const ORDER_ACTIONS = ['pick', 'ship', 'deliver', 'cancel', 'refund'] as const
export type OrderAction = (typeof ORDER_ACTIONS)[number]

const ORDER_NUMBER = /^[A-Z]{2}-\d{4}-\d{6}$/
const Ship = z.object({
  courier: z.string().trim().min(1).max(60),
  trackingNumber: z.string().trim().min(3).max(64),
  trackingUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || null),
})
const Cancel = z.object({ reason: z.string().trim().min(1).max(300) })

const STATUS: Record<Exclude<FulfilmentResult, { ok: true }>['reason'], number> = {
  'not-found': 404,
  'not-confirmed': 409,
  'wrong-status': 409,
  'hold-missing': 409,
  'invalid-shipment': 422,
  'not-refundable': 409,
}

const DONE: Record<OrderAction, string> = {
  pick: 'picked',
  ship: 'shipped',
  deliver: 'delivered',
  cancel: 'cancelled',
  refund: 'refunded',
}

export const opsOrderPath = (number: string) => `/ops/orders/${encodeURIComponent(number)}/`

export async function postOrderAction(
  deps: { payload: Payload; provider?: () => PaymentProvider | null; now?: () => Date },
  request: Request,
  number: string,
  action: string,
): Promise<Response> {
  const form = isForm(request)
  const staff = await requireStaff(deps.payload, request)
  if (staff instanceof Response) {
    return form && staff.status === 401
      ? seeOther(withQuery('/admin/login', { redirect: opsOrderPath(number) }))
      : staff
  }
  if (!ORDER_NUMBER.test(number) || !(ORDER_ACTIONS as readonly string[]).includes(action))
    return problem(404, 'not-found', 'No such order action.')
  const fields = (await readFields(request)) ?? {}
  const back = (query: Record<string, string>) => seeOther(withQuery(opsOrderPath(number), query))
  const invalid = (error: z.ZodError) =>
    form
      ? back({ error: 'invalid' })
      : problem(400, 'invalid-request', 'The request is invalid.', error.flatten())

  const fulfilment = createFulfilment(
    deps.payload,
    (deps.provider ?? (() => paymentProvider()))(),
    deps.now,
  )
  const actor = { user: staff.id }
  let result: FulfilmentResult
  switch (action as OrderAction) {
    case 'pick':
      result = await fulfilment.pick(number, actor)
      break
    case 'ship': {
      const body = Ship.safeParse(fields)
      if (!body.success) return invalid(body.error)
      result = await fulfilment.ship(number, body.data, actor)
      break
    }
    case 'deliver':
      result = await fulfilment.deliver(number, actor)
      break
    case 'cancel': {
      const body = Cancel.safeParse(fields)
      if (!body.success) return invalid(body.error)
      result = await fulfilment.cancel(number, body.data.reason, actor)
      break
    }
    case 'refund':
      result = await fulfilment.refund(number)
      break
  }
  if (!result.ok) {
    return form
      ? back({ error: result.reason })
      : problem(
          STATUS[result.reason],
          result.reason,
          `The order cannot be ${DONE[action as OrderAction]} now.`,
          {
            fulfilment: result.order?.fulfilment ?? null,
            ...(result.detail ? { detail: result.detail } : {}),
          },
        )
  }
  const summary = {
    number: result.order.number,
    fulfilment: result.order.fulfilment,
    refund: result.order.refund.status,
    shipment: result.order.shipment?.number ?? null,
    changed: result.changed,
  }
  return form ? back({ result: DONE[action as OrderAction] }) : json(summary)
}
