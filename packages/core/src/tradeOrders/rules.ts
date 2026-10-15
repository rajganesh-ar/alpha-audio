import { money, type Money } from '../money'
import type { Approval, TradeLine } from './types'
import { MAX_TRADE_LINES, MAX_TRADE_QTY } from './types'

/** A company's order rules (Companies.settings). Money is minor units of the market currency. */
export interface OrderRules {
  orderMultiple: number | null
  minOrderValue: bigint | null
}

export type TradeLineProblem =
  | { sku: string; problem: 'unavailable' }
  | { sku: string; problem: 'invalid-quantity' }
  | { sku: string; problem: 'multiple'; multiple: number }
export type TradeOrderProblem =
  | { problem: 'empty' }
  | { problem: 'too-many-lines'; max: number }
  | { problem: 'minimum-value'; minimum: Money }

export interface RuleCheck {
  lines: TradeLineProblem[]
  order: TradeOrderProblem[]
}

/**
 * The company's order rules (spec: dealer board rules; failures are explained inline, never
 * silent). Lines are checked one by one, then the order; the net total excludes VAT.
 */
export function checkOrderRules(
  lines: readonly Pick<TradeLine, 'sku' | 'qty' | 'status'>[],
  net: Money,
  rules: OrderRules,
): RuleCheck {
  const order: TradeOrderProblem[] = []
  if (lines.length === 0) order.push({ problem: 'empty' })
  if (lines.length > MAX_TRADE_LINES)
    order.push({ problem: 'too-many-lines', max: MAX_TRADE_LINES })
  const problems: TradeLineProblem[] = []
  for (const line of lines) {
    if (!Number.isSafeInteger(line.qty) || line.qty < 1 || line.qty > MAX_TRADE_QTY)
      problems.push({ sku: line.sku, problem: 'invalid-quantity' })
    else if (line.status === 'unavailable') problems.push({ sku: line.sku, problem: 'unavailable' })
    else if (rules.orderMultiple && rules.orderMultiple > 1 && line.qty % rules.orderMultiple !== 0)
      problems.push({ sku: line.sku, problem: 'multiple', multiple: rules.orderMultiple })
  }
  if (lines.length && rules.minOrderValue !== null && net.amount < rules.minOrderValue)
    order.push({
      problem: 'minimum-value',
      minimum: money(rules.minOrderValue, net.currency, net.decimals),
    })
  return { lines: problems, order }
}

export const rulesPass = (check: RuleCheck): boolean =>
  check.lines.length === 0 && check.order.length === 0

export interface CreditPosition {
  /** Null when the company has no credit line (every order then needs Alpha's approval). */
  limit: Money | null
  used: Money
  /** `limit − used`, never below zero; null without a credit line. */
  available: Money | null
}

export function creditPosition(limit: bigint | null, used: bigint, like: Money): CreditPosition {
  const m = (amount: bigint) => money(amount, like.currency, like.decimals)
  return {
    limit: limit === null ? null : m(limit),
    used: m(used),
    available: limit === null ? null : m(limit > used ? limit - used : 0n),
  }
}

export interface ApprovalInput {
  placer: { role: string; approvalThreshold: bigint | null }
  lines: readonly Pick<TradeLine, 'status'>[]
  totals: { net: Money; gross: Money }
  creditLimit: bigint | null
  creditUsed: bigint
}

/**
 * The approvals an order needs (docs/tasks/0015). The company's owner approves a purchaser's
 * order whose net value is above the purchaser's threshold; Alpha approves an order that takes
 * the company over its credit limit (or has no credit line) or carries a below-floor price.
 */
export function approvalsFor(input: ApprovalInput): Approval[] {
  const pending = (kind: Approval['kind'], reason: Approval['reason']): Approval => ({
    kind,
    reason,
    status: 'pending',
    by: null,
    at: null,
    note: null,
  })
  const out: Approval[] = []
  const threshold = input.placer.approvalThreshold
  if (
    input.placer.role === 'purchaser' &&
    threshold !== null &&
    input.totals.net.amount > threshold
  )
    out.push(pending('company', 'threshold'))
  if (
    input.creditLimit === null ||
    input.creditUsed + input.totals.gross.amount > input.creditLimit
  )
    out.push(pending('alpha', 'credit'))
  if (input.lines.some((l) => l.status === 'needs-approval')) out.push(pending('alpha', 'price'))
  return out
}

/** Company roles that may place orders (viewers and installers browse only). */
export const ORDERING_ROLES: readonly string[] = ['owner', 'purchaser']
