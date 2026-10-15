import { describe, expect, it } from 'vitest'
import { money } from '@alpha/core'
import { orderAccessToken } from '../system/orderTokens'
import { EMAIL_MESSAGES } from './messages'
import { renderEmail, renderSignInEmail, type EmailOrder } from './render'

const aed = (n: number) => money(n, 'AED', 2)
const order = (locale: 'en' | 'ar'): EmailOrder => ({
  number: 'AE-2026-000042',
  name: 'Layla <b>Haddad</b>',
  locale,
  languageTag: `${locale}-AE`,
  lines: [{ title: 'MA352 integrated amplifier', qty: 1, lineTotal: aed(3_450_000) }],
  totals: { subtotal: aed(3_450_000), vat: aed(164_286), delivery: aed(0), total: aed(3_450_000) },
  link: 'https://www.alphaaudios.com/ae/en/orders/AE-2026-000042/?token=abc',
  shipment: {
    courier: 'Aramex',
    trackingNumber: '44219988',
    trackingUrl: 'https://aramex.example/t/44219988',
  },
})

describe('order emails', () => {
  it('renders the subject, totals, tracking and the order link, escaping customer text', () => {
    const email = renderEmail('order-shipped', order('en'))
    expect(email.subject).toBe('Order AE-2026-000042 is on its way')
    expect(email.text).toContain('Hello Layla <b>Haddad</b>,')
    expect(email.text).toContain('Tracking number: 44219988')
    expect(email.text).toMatch(/Includes VAT: AED\s1,642\.86/)
    expect(email.text).toContain(
      'View your order: https://www.alphaaudios.com/ae/en/orders/AE-2026-000042/?token=abc',
    )
    expect(email.html).toContain('Layla &lt;b&gt;Haddad&lt;/b&gt;')
    expect(email.html).not.toContain('<b>Haddad</b>')
    expect(email.html).toContain('<html lang="en" dir="ltr">')
  })

  it('renders Arabic right to left with Western digits', () => {
    const email = renderEmail('order-confirmed', { ...order('ar'), shipment: null })
    expect(email.subject).toBe('تم تأكيد الطلب AE-2026-000042')
    expect(email.html).toContain('<html lang="ar" dir="rtl">')
    expect(email.text).toMatch(/34,500\.00/)
    expect(email.text).not.toMatch(/[٠-٩]/)
    expect(email.text).not.toContain('Aramex')
  })

  it('has every template in both languages, Arabic in draft', () => {
    expect(Object.keys(EMAIL_MESSAGES.ar.templates)).toEqual(
      Object.keys(EMAIL_MESSAGES.en.templates),
    )
    expect(EMAIL_MESSAGES.ar.status).toBe('draft')
  })

  it('derives a stable order token from the instance secret', () => {
    const token = orderAccessToken({ secret: 's1' }, 'key')
    expect(orderAccessToken({ secret: 's1' }, 'key')).toBe(token)
    expect(orderAccessToken({ secret: 's2' }, 'key')).not.toBe(token)
    expect(token).toMatch(/^[\w-]{43}$/)
  })

  it('renders the sign-in email with only the link, in both languages', () => {
    const en = renderSignInEmail(
      'en',
      'https://www.alphaaudios.com/ae/en/account/verify/?token=abc',
    )
    expect(en.subject).toBe('Your Alpha Audio sign-in link')
    expect(en.text).toContain(
      'Sign in: https://www.alphaaudios.com/ae/en/account/verify/?token=abc',
    )
    expect(en.html).toContain('href="https://www.alphaaudios.com/ae/en/account/verify/?token=abc"')
    const ar = renderSignInEmail('ar', 'https://x/')
    expect(ar.html).toContain('<html lang="ar" dir="rtl">')
    expect(ar.subject).toBe('رابط تسجيل الدخول إلى ألفا أوديو')
  })
})
