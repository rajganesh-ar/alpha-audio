import { describe, expect, it } from 'vitest'
import { money } from '@alpha/core'
import { SANDBOX_SIGNATURE_HEADER, SandboxPaymentProvider } from './sandbox'

const SECRET = 'sandbox-secret-0123456789abcdef-0123456789'
const provider = new SandboxPaymentProvider(
  SECRET,
  (intent, query) => `/ae/en/checkout/sandbox/${intent}/?${query}`,
)
const request = {
  orderNumber: 'AE-2026-000001',
  amount: money(3_450_000, 'AED', 2),
  method: 'card',
  returnUrl: '/ae/en/checkout/return/?order=AE-2026-000001',
  idempotencyKey: 'k1',
  locale: 'en',
}

describe('SandboxPaymentProvider', () => {
  it('creates the same intent for the same idempotency key, and a signed hosted link', async () => {
    const a = await provider.createPayment(request)
    const b = await provider.createPayment(request)
    expect(a).toEqual(b)
    expect((await provider.createPayment({ ...request, idempotencyKey: 'k2' })).intentId).not.toBe(
      a.intentId,
    )
    const query = new URL(a.redirectUrl, 'http://x').searchParams
    expect(provider.readIntent(a.intentId, query)).toEqual({
      orderNumber: 'AE-2026-000001',
      amount: money(3_450_000, 'AED', 2),
      returnUrl: request.returnUrl,
    })
    query.set('amount', '1')
    expect(provider.readIntent(a.intentId, query)).toBeNull()
  })

  it('accepts only events it signed', () => {
    const { body, signature } = provider.event('sbx_1', 'captured', money(100, 'AED', 2), 'evt_1')
    expect(provider.parseWebhook(body, { [SANDBOX_SIGNATURE_HEADER]: signature })).toEqual({
      provider: 'sandbox',
      eventId: 'evt_1',
      intentId: 'sbx_1',
      type: 'captured',
      amount: 100n,
      currency: 'AED',
    })
    expect(provider.parseWebhook(body, { [SANDBOX_SIGNATURE_HEADER]: 'bad' })).toBeNull()
    expect(provider.parseWebhook(body, {})).toBeNull()
    const other = new SandboxPaymentProvider(`${SECRET}-other`, () => '')
    expect(other.parseWebhook(body, { [SANDBOX_SIGNATURE_HEADER]: signature })).toBeNull()
  })

  it('rejects malformed bodies even when signed, and short secrets', () => {
    // reason: reach the private signer to sign tampered bodies with the real secret
    const sign = (body: string) => (provider as unknown as { sign(v: string): string }).sign(body)
    for (const body of [
      'not json',
      JSON.stringify({ id: 'e', intent: 'x', type: 'refunded', amount: '1', currency: 'AED' }),
      JSON.stringify({ id: 'e', intent: 'x', type: 'captured', amount: '-1', currency: 'AED' }),
    ]) {
      expect(provider.parseWebhook(body, { [SANDBOX_SIGNATURE_HEADER]: sign(body) })).toBeNull()
    }
    expect(() => new SandboxPaymentProvider('short', () => '')).toThrow()
  })
})
