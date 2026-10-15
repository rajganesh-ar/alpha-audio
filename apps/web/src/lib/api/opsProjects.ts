import type { Payload } from 'payload'
import { decideProject, getMarketsCached, PostgresProjectStore } from '@alpha/payload'
import { isForm, readFields, seeOther, withQuery } from './forms'
import { json, problem, requireStaff } from './respond'

/**
 * Ops endpoint for project registrations (docs/tasks/0017):
 * `POST /api/v1/ops/projects/{number}/{approve|reject|decide}`. Staff only (Payload session),
 * same-origin. The review form sends a project price per SKU as `price:<SKU>` in the market's
 * currency (e.g. `3500.00`), a validity in days and a note; the pressed button names the
 * decision (`decide`).
 */
const NUMBER = /^P-[A-Z]{2}-\d{4}-\d{6}$/
const DECISIONS: ReadonlyMap<string, 'approve' | 'reject'> = new Map([
  ['approve', 'approve'],
  ['reject', 'reject'],
])
export const opsProjectPath = (number: string) => `/ops/projects/${encodeURIComponent(number)}/`

/** `1234.5` in a currency with `decimals` → minor units; null when not a plain amount. */
export function toMinor(text: string, decimals: number): bigint | null {
  const trimmed = text.trim().replace(/,/g, '')
  if (!trimmed) return null
  if (!/^\d{1,12}(\.\d+)?$/.test(trimmed)) return null
  const [whole = '0', fraction = ''] = trimmed.split('.')
  if (fraction.length > decimals) return null
  return BigInt(whole + fraction.padEnd(decimals, '0'))
}

export async function postProjectDecision(
  deps: { payload: Payload; now?: () => Date },
  request: Request,
  number: string,
  action: string,
): Promise<Response> {
  const form = isForm(request)
  const staff = await requireStaff(deps.payload, request)
  if (staff instanceof Response) {
    return form && staff.status === 401
      ? seeOther(withQuery('/admin/login', { redirect: opsProjectPath(number) }))
      : staff
  }
  const fields = (await readFields(request)) ?? {}
  const decision = DECISIONS.get(action === 'decide' ? String(fields['decision'] ?? '') : action)
  if (!NUMBER.test(number) || !decision) return problem(404, 'not-found', 'No such project action.')
  const project = await new PostgresProjectStore(deps.payload).findByNumber(number)
  if (!project) return problem(404, 'not-found', 'No such project registration.')
  const market = (await getMarketsCached(deps.payload)).find((m) => m.code === project.market)
  const decimals = market?.decimals ?? 2

  const prices: Record<string, bigint> = {}
  let invalid = false
  for (const line of project.lines) {
    const raw = fields[`price:${line.sku}`]
    if (typeof raw !== 'string' || !raw.trim()) continue
    const minor = toMinor(raw, decimals)
    if (minor === null) invalid = true
    else prices[line.sku] = minor
  }
  const back = (result: string) =>
    form ? seeOther(withQuery(opsProjectPath(number), { result })) : null
  if (invalid && decision === 'approve')
    return back('invalid-price') ?? problem(422, 'invalid-price', 'Prices are plain amounts.')
  const days = Number(fields['validityDays'] ?? 90)
  const result = await decideProject(
    deps.payload,
    staff,
    number,
    {
      decision,
      prices,
      validityDays: Number.isFinite(days) ? days : 90,
      note: typeof fields['note'] === 'string' ? fields['note'] : null,
    },
    deps.now,
  )
  const outcome = result.ok ? (decision === 'approve' ? 'approved' : 'rejected') : result.reason
  if (form) return seeOther(withQuery('/ops/projects/', { result: outcome, project: number }))
  if (result.ok) return json({ project: result.project })
  return problem(result.reason === 'not-found' ? 404 : 409, result.reason, 'Not decided.')
}
