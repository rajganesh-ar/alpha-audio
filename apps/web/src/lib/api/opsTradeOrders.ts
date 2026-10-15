import type { Payload } from 'payload'
import { decideTradeOrder } from '@alpha/payload'
import { isForm, readFields, seeOther, withQuery } from './forms'
import { json, problem, requireStaff } from './respond'

/**
 * Ops endpoint for Alpha's decision on a dealer order (docs/tasks/0015):
 * `POST /api/v1/ops/trade-orders/{number}/{approve|reject|decide}`. Staff only (Payload
 * session), same-origin. The ops screen posts one form whose pressed button names the decision
 * (`decide`); scripts send JSON to `approve` or `reject`.
 */
const ORDER_NUMBER = /^T-[A-Z]{2}-\d{4}-\d{6}$/
const DECISIONS: ReadonlyMap<string, 'approve' | 'reject'> = new Map([
  ['approve', 'approve'],
  ['reject', 'reject'],
])
export const OPS_TRADE_PATH = '/ops/trade-orders/'

export async function postTradeOrderAction(
  deps: { payload: Payload; now?: () => Date },
  request: Request,
  number: string,
  action: string,
): Promise<Response> {
  const form = isForm(request)
  const staff = await requireStaff(deps.payload, request)
  if (staff instanceof Response) {
    return form && staff.status === 401
      ? seeOther(withQuery('/admin/login', { redirect: OPS_TRADE_PATH }))
      : staff
  }
  const fields = (await readFields(request)) ?? {}
  const decision = DECISIONS.get(action === 'decide' ? String(fields['decision'] ?? '') : action)
  if (!ORDER_NUMBER.test(number) || !decision)
    return problem(404, 'not-found', 'No such dealer order action.')
  const note = typeof fields['reason'] === 'string' ? fields['reason'] : null
  const result = await decideTradeOrder(deps.payload, staff, number, decision, note, deps.now)
  const outcome = result.ok ? (decision === 'approve' ? 'approved' : 'rejected') : result.reason
  if (form) return seeOther(withQuery(OPS_TRADE_PATH, { result: outcome, order: number }))
  if (result.ok) return json({ order: result.order })
  return problem(
    result.reason === 'not-found' ? 404 : result.reason === 'forbidden' ? 403 : 409,
    result.reason,
    'The decision was not recorded.',
  )
}
