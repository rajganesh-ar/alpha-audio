import { formatMoney, type Money, type NotificationTemplate } from '@alpha/core'
import type { LocaleCode } from '../markets/codes'
import { EMAIL_MESSAGES } from './messages'

export interface EmailOrder {
  number: string
  name: string
  locale: LocaleCode
  /** BCP 47 tag for numbers and money, e.g. `ar-AE`. */
  languageTag: string
  lines: ReadonlyArray<{ title: string; qty: number; lineTotal: Money }>
  totals: { subtotal: Money; vat: Money; delivery: Money; total: Money }
  link: string
  shipment?: { courier: string; trackingNumber: string; trackingUrl: string | null } | null
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

const escape = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  )
const fill = (template: string, vars: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`)

/**
 * One customer email, as HTML and plain text. Plain markup with no colours or images, `lang` and
 * `dir` on the document, Western digits in money (`formatMoney`); amounts come from the order.
 */
export function renderEmail(template: NotificationTemplate, order: EmailOrder): RenderedEmail {
  const m = EMAIL_MESSAGES[order.locale]
  const copy = m.templates[template]
  const dir = order.locale === 'ar' ? 'rtl' : 'ltr'
  const money = (value: Money) => formatMoney(value, order.languageTag)
  const vars = { number: order.number, name: order.name }
  const rows: Array<[string, string]> = [
    [m.subtotal, money(order.totals.subtotal)],
    [
      m.delivery,
      order.totals.delivery.amount === 0n ? m.deliveryFree : money(order.totals.delivery),
    ],
    [m.total, money(order.totals.total)],
    [m.vat, money(order.totals.vat)],
  ]
  const shipment = order.shipment

  const text = [
    fill(m.greeting, vars),
    '',
    copy.heading,
    copy.body,
    '',
    `${m.orderNumber}: ${order.number}`,
    ...(shipment
      ? [
          `${m.courier}: ${shipment.courier}`,
          `${m.tracking}: ${shipment.trackingNumber}`,
          ...(shipment.trackingUrl ? [`${m.track}: ${shipment.trackingUrl}`] : []),
        ]
      : []),
    '',
    `${m.lines}:`,
    ...order.lines.map((l) => `${l.qty} × ${l.title}  ${money(l.lineTotal)}`),
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    `${m.view}: ${order.link}`,
    '',
    m.footer,
  ].join('\n')

  const cell = 'padding:4px 0;'
  const html = `<!doctype html>
<html lang="${order.locale}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(fill(copy.subject, vars))}</title></head>
<body style="font-family:system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;line-height:1.5;margin:0;padding:24px;">
<div style="max-width:560px;margin:0 auto;">
<p>${escape(fill(m.greeting, vars))}</p>
<h1 style="font-size:22px;margin:16px 0 8px;">${escape(copy.heading)}</h1>
<p>${escape(copy.body)}</p>
<p><strong>${escape(m.orderNumber)}:</strong> <span dir="ltr">${escape(order.number)}</span></p>
${
  shipment
    ? `<p><strong>${escape(m.courier)}:</strong> ${escape(shipment.courier)}<br><strong>${escape(m.tracking)}:</strong> <span dir="ltr">${escape(shipment.trackingNumber)}</span>${
        shipment.trackingUrl
          ? `<br><a href="${escape(shipment.trackingUrl)}">${escape(m.track)}</a>`
          : ''
      }</p>`
    : ''
}
<h2 style="font-size:16px;margin:24px 0 8px;">${escape(m.lines)}</h2>
<table role="presentation" style="width:100%;border-collapse:collapse;">
${order.lines.map((l) => `<tr><td style="${cell}">${l.qty} × ${escape(l.title)}</td><td style="${cell}text-align:end;white-space:nowrap;"><bdi>${escape(money(l.lineTotal))}</bdi></td></tr>`).join('\n')}
${rows.map(([label, value], i) => `<tr><td style="${cell}${i === 2 ? 'font-weight:bold;' : ''}">${escape(label)}</td><td style="${cell}text-align:end;white-space:nowrap;${i === 2 ? 'font-weight:bold;' : ''}"><bdi>${escape(value)}</bdi></td></tr>`).join('\n')}
</table>
<p style="margin:24px 0;"><a href="${escape(order.link)}">${escape(m.view)}</a></p>
<p style="font-size:13px;">${escape(m.footer)}</p>
</div>
</body>
</html>`
  return { subject: fill(copy.subject, vars), html, text }
}
