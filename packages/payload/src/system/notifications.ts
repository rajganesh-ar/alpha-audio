import type { Payload } from 'payload'
import {
  money,
  type CurrencyCode,
  type CurrencyDecimals,
  type NotificationTemplate,
} from '@alpha/core'
import { isLocaleCode, type LocaleCode } from '../markets/codes'
import { renderEmail, type RenderedEmail } from '../notifications/render'
import { orderAccessToken } from './orderTokens'

/**
 * The customer notification outbox (docs/tasks/0010). System code: notifications and orders are
 * read and written with `overrideAccess: true` (shoppers are anonymous and no user may write
 * either collection). One row per order and template, then a `sendNotification` job.
 */

export const NOTIFICATIONS_QUEUE = 'notifications'
export const SEND_NOTIFICATION = 'sendNotification'
/** Delivery attempts before a notification is marked `failed` (the first try plus retries). */
export const MAX_NOTIFICATION_ATTEMPTS = 5

// System reads and writes: see the module comment.
const system = {
  depth: 0,
  // Shoppers are anonymous and nobody may write notifications or orders through the API.
  overrideAccess: true,
} as const

interface OrderForEmail {
  id: number
  number: string
  market: string
  locale: string
  currency: string
  decimals: number
  idempotencyKey: string
  contact?: { name?: string | null; email?: string | null } | null
  lines?: Array<{ title: string; qty: number; lineTotal: number }> | null
  totals: { subtotal: number; vat: number; delivery: number; total: number }
  shipment?:
    { courier: string; trackingNumber: string; trackingUrl?: string | null } | number | null
}

/**
 * Queues an email for an order, once: a second call for the same order and template does
 * nothing (`key` is unique). Returns whether this call queued it.
 */
export async function queueNotification(
  payload: Payload,
  orderId: number,
  template: NotificationTemplate,
): Promise<boolean> {
  const order = (await payload.findByID({
    collection: 'orders',
    id: orderId,
    ...system,
  })) as unknown as OrderForEmail
  const to = order.contact?.email
  if (!to) return false
  const key = `${order.number}:${template}`
  let id: number
  try {
    const doc = await payload.create({
      collection: 'notifications',
      data: {
        key,
        order: order.id,
        template,
        channel: 'email',
        locale: (isLocaleCode(order.locale) ? order.locale : 'en') as LocaleCode,
        to,
        status: 'queued',
        attempts: 0,
      },
      ...system,
    })
    id = Number(doc.id)
  } catch (error) {
    // The unique key: this order and template were queued before.
    const { totalDocs } = await payload.count({
      collection: 'notifications',
      where: { key: { equals: key } },
      // System read: see the module comment.
      overrideAccess: true,
    })
    if (totalDocs > 0) return false
    throw error
  }
  await payload.jobs.queue({
    task: SEND_NOTIFICATION,
    input: { notification: id },
    queue: NOTIFICATIONS_QUEUE,
  })
  return true
}

export interface OutgoingEmail extends RenderedEmail {
  to: string
}

export type SendEmail = (email: OutgoingEmail) => Promise<unknown>

/** The order email for a notification, with the order link carrying its access token. */
export async function renderNotification(
  payload: Payload,
  notificationId: number,
): Promise<{ email: OutgoingEmail; status: string; attempts: number } | null> {
  const row = await payload.findByID({
    collection: 'notifications',
    id: notificationId,
    ...system,
    disableErrors: true,
  })
  if (!row) return null
  const orderId = typeof row.order === 'object' ? row.order.id : row.order
  const order = (await payload.findByID({
    collection: 'orders',
    id: orderId,
    depth: 1,
    // System read: the job renders the order for its anonymous customer.
    overrideAccess: true,
  })) as unknown as OrderForEmail
  const m = (amount: number) =>
    money(
      Number(amount),
      order.currency as CurrencyCode,
      Number(order.decimals) as CurrencyDecimals,
    )
  const locale = (isLocaleCode(row.locale) ? row.locale : 'en') as LocaleCode
  const origin = payload.config.serverURL.replace(/\/$/, '')
  const link = `${origin}/${order.market}/${locale}/orders/${encodeURIComponent(order.number)}/?token=${orderAccessToken(payload, order.idempotencyKey)}`
  const shipment = typeof order.shipment === 'object' && order.shipment ? order.shipment : null
  const email = renderEmail(row.template, {
    number: order.number,
    name: order.contact?.name ?? '',
    locale,
    languageTag: `${locale}-${order.market.toUpperCase()}`,
    lines: (order.lines ?? []).map((l) => ({
      title: l.title,
      qty: Number(l.qty),
      lineTotal: m(l.lineTotal),
    })),
    totals: {
      subtotal: m(order.totals.subtotal),
      vat: m(order.totals.vat),
      delivery: m(order.totals.delivery),
      total: m(order.totals.total),
    },
    link,
    shipment: shipment
      ? {
          courier: shipment.courier,
          trackingNumber: shipment.trackingNumber,
          trackingUrl: shipment.trackingUrl ?? null,
        }
      : null,
  })
  return {
    email: { ...email, to: row.to },
    status: row.status,
    attempts: Number(row.attempts ?? 0),
  }
}

/**
 * Sends one queued notification (the `sendNotification` job). Idempotent: a sent one is not sent
 * again. A failure counts the attempt, keeps the error, and rethrows so the job retries; the
 * last attempt marks the row `failed` for the dead-letter review.
 */
export async function deliverNotification(
  payload: Payload,
  notificationId: number,
  send: SendEmail = (email) => payload.sendEmail(email),
  now: () => Date = () => new Date(),
): Promise<'sent' | 'already-sent' | 'missing'> {
  const rendered = await renderNotification(payload, notificationId)
  if (!rendered) return 'missing'
  if (rendered.status === 'sent') return 'already-sent'
  const attempts = rendered.attempts + 1
  try {
    await send(rendered.email)
  } catch (error) {
    await payload.update({
      collection: 'notifications',
      id: notificationId,
      data: {
        attempts,
        lastError: (error instanceof Error ? error.message : String(error)).slice(0, 300),
        status: attempts >= MAX_NOTIFICATION_ATTEMPTS ? 'failed' : 'queued',
      },
      ...system,
    })
    throw error
  }
  await payload.update({
    collection: 'notifications',
    id: notificationId,
    data: { attempts, status: 'sent', sentAt: now().toISOString(), lastError: null },
    ...system,
  })
  return 'sent'
}
