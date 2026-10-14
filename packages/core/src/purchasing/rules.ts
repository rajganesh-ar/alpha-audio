import { ReceivingError } from './errors'
import type { PoStatus } from './types'

/**
 * Status changes staff may make by hand. Receiving owns `partially_received` and `received`;
 * a PO cannot be cancelled once anything has arrived (close it instead).
 */
const MANUAL: Record<PoStatus, readonly PoStatus[]> = {
  draft: ['ordered', 'cancelled'],
  ordered: ['cancelled', 'closed'],
  partially_received: ['closed'],
  received: ['closed'],
  closed: [],
  cancelled: [],
}

export function assertManualPoStatusChange(
  from: PoStatus,
  to: PoStatus,
  anythingReceived: boolean,
): void {
  if (from === to) return
  if (!MANUAL[from].includes(to)) {
    throw new ReceivingError(
      'invalid-status-change',
      `A purchase order cannot go from ${from} to ${to} by hand.`,
    )
  }
  if (to === 'cancelled' && anythingReceived) {
    throw new ReceivingError(
      'invalid-status-change',
      'Stock has been received against this order; close it instead of cancelling.',
    )
  }
}

/** Lines (what was ordered) may change only while the PO is a draft. */
export function linesEditable(status: PoStatus): boolean {
  return status === 'draft'
}
