import { describe, expect, it } from 'vitest'
import { ADDRESS_SCHEME_FIELDS, money, priceBag } from '@alpha/core'
import { ADDRESS_SCHEMES, SandboxPaymentProvider } from '@alpha/payload'
import { bagCookie, bagCookieHeader, readCookie } from './cookies'
import { paymentProvider, sandboxSecret } from './payments'
import { FORM_KEY, idempotencyKey, newFormKey, orderAccessToken } from './tokens'

const env = {
  DATABASE_URL: 'postgres://alpha:alpha@localhost:5432/alpha',
  PAYLOAD_SECRET: 'unit-test-secret-000000000000000000000000000000',
  NEXT_PUBLIC_SERVER_URL: 'http://localhost:3000',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'alpha-media',
  S3_ACCESS_KEY_ID: 'x',
  S3_SECRET_ACCESS_KEY: 'y',
}
const market = { code: 'ae', currency: 'AED', decimals: 2, vatRate: 5 } as const
const bagOf = (qty: number, amount = 1_050_000) =>
  priceBag(
    [{ sku: 'A', qty }],
    (sku) => ({
      sku,
      productId: 1,
      title: 'A',
      onSale: true,
      price: {
        kind: 'priced',
        price: money(amount, 'AED', 2),
        vat: money(50_000, 'AED', 2),
        vatRate: 5,
      },
    }),
    market,
  )

describe('checkout tokens', () => {
  it('derives one idempotency key per cart, form rendering and bag', () => {
    const key = idempotencyKey(7, 'form-key-aaaaaaaaaaaa', bagOf(1))
    expect(idempotencyKey(7, 'form-key-aaaaaaaaaaaa', bagOf(1))).toBe(key)
    expect(idempotencyKey(7, 'form-key-aaaaaaaaaaaa', bagOf(2))).not.toBe(key)
    expect(idempotencyKey(7, 'form-key-aaaaaaaaaaaa', bagOf(1, 1_100_000))).not.toBe(key)
    expect(idempotencyKey(8, 'form-key-aaaaaaaaaaaa', bagOf(1))).not.toBe(key)
    expect(idempotencyKey(7, 'form-key-bbbbbbbbbbbb', bagOf(1))).not.toBe(key)
  })

  it('makes fresh form keys and a stable, secret-bound access token', () => {
    expect(newFormKey()).toMatch(FORM_KEY)
    expect(newFormKey()).not.toBe(newFormKey())
    const token = orderAccessToken('k', env)
    expect(orderAccessToken('k', env)).toBe(token)
    expect(orderAccessToken('k', { ...env, PAYLOAD_SECRET: `${env.PAYLOAD_SECRET}1` })).not.toBe(
      token,
    )
    expect(token).toMatch(/^[\w-]{43}$/)
  })
})

describe('bag cookie', () => {
  it('is per market, httpOnly, SameSite=Lax and Secure on https', () => {
    expect(bagCookie('sa')).toBe('alpha_bag_sa')
    expect(bagCookieHeader('ae', 'tok', true)).toBe(
      'alpha_bag_ae=tok; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax; Secure',
    )
    expect(bagCookieHeader('ae', 'tok', false)).not.toMatch(/Secure/)
    const request = new Request('http://x/', {
      headers: { cookie: 'a=1; alpha_bag_ae=t%2Bk; b=2' },
    })
    expect(readCookie(request, 'alpha_bag_ae')).toBe('t+k')
    expect(readCookie(request, 'alpha_bag_sa')).toBeUndefined()
  })
})

describe('payment provider', () => {
  it('is the sandbox outside production, with its own or a derived secret', () => {
    expect(paymentProvider(undefined, { ...env, NODE_ENV: 'development' })).toBeInstanceOf(
      SandboxPaymentProvider,
    )
    expect(sandboxSecret(env)).toHaveLength(64)
    expect(sandboxSecret({ ...env, PAYMENT_SANDBOX_SECRET: 's'.repeat(40) })).toBe('s'.repeat(40))
  })

  it('is refused in production unless the sandbox is explicitly allowed (staging)', () => {
    expect(paymentProvider(undefined, { ...env, NODE_ENV: 'production' })).toBeNull()
    expect(
      paymentProvider(undefined, {
        ...env,
        NODE_ENV: 'production',
        PAYMENT_SANDBOX_ALLOWED: 'true',
      }),
    ).toBeInstanceOf(SandboxPaymentProvider)
  })
})

describe('address schemes', () => {
  it('has a field list for every scheme the Markets record can name', () => {
    expect(Object.keys(ADDRESS_SCHEME_FIELDS).sort()).toEqual([...ADDRESS_SCHEMES].sort())
  })
})
