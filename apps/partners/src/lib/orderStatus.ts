import type { TradeOrderStatus } from '@alpha/core'
import type { BadgeTone } from '@alpha/ui'

/** How each dealer order status reads as a badge. */
export const STATUS_TONE: Record<TradeOrderStatus, BadgeTone> = {
  reserving: 'neutral',
  unavailable: 'critical',
  'pending-approval': 'caution',
  approving: 'caution',
  confirmed: 'positive',
  rejected: 'critical',
  cancelled: 'neutral',
  failed: 'critical',
}

/** A date and time in the market's time zone, Western digits. */
export const dateTime = (iso: string | null | undefined, locale: string, timeZone: string) =>
  iso
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(
        new Date(iso),
      )
    : ''

/** How each quote status reads as a badge. */
export const QUOTE_TONE: Record<
  'open' | 'ordering' | 'ordered' | 'withdrawn' | 'expired',
  BadgeTone
> = {
  open: 'positive',
  ordering: 'caution',
  ordered: 'neutral',
  withdrawn: 'neutral',
  expired: 'critical',
}

/** An open quote past its validity reads as expired, whether or not anyone has used it since. */
export const quoteState = (status: string, validUntil: string, now = Date.now()) =>
  (status === 'open' && Date.parse(validUntil) <= now
    ? 'expired'
    : status) as keyof typeof QUOTE_TONE

type ProjectState = 'submitted' | 'reviewing' | 'approved' | 'rejected' | 'withdrawn' | 'expired'

/** How each project registration status reads as a badge. */
export const PROJECT_TONE: Record<ProjectState, BadgeTone> = {
  submitted: 'caution',
  reviewing: 'caution',
  approved: 'positive',
  rejected: 'critical',
  withdrawn: 'neutral',
  expired: 'critical',
}

/** An approved project past its validity reads as expired. */
export const projectStateOf = (
  status: string,
  validUntil: string | null | undefined,
  now = Date.now(),
) =>
  (status === 'approved' && validUntil && Date.parse(validUntil) <= now
    ? 'expired'
    : status) as ProjectState
