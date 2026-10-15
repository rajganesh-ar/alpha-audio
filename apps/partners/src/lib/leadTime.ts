import type { Translate } from '@alpha/ui'

const HOUR = 60 * 60 * 1000

/** The acceptance timer in words ("about 23 hours left"), and whether it is urgent (< 2 h). */
export function timeLeft(
  acceptBy: Date,
  now: Date,
  t: Translate,
): { text: string; urgent: boolean } {
  const ms = acceptBy.getTime() - now.getTime()
  if (ms <= 0) return { text: t('partners.leads.left.passed'), urgent: true }
  if (ms < HOUR) return { text: t('partners.leads.left.minutes'), urgent: true }
  const hours = Math.floor(ms / HOUR)
  return { text: t('partners.leads.left.hours', { count: hours }), urgent: hours < 2 }
}
