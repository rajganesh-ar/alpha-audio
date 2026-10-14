import { describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { z } from 'zod'
import { LedgerError, ReceivingError } from '@alpha/core'
import { parseBody, requireStaff, serviceError } from './respond'

const payloadWith = (user: unknown) => ({ auth: async () => ({ user }) }) as unknown as Payload
const request = (headers: Record<string, string> = {}, body?: string) =>
  new Request('http://localhost:3000/api/v1/ops/x', { method: 'POST', headers, body: body ?? null })

describe('requireStaff', () => {
  it('refuses anonymous, non-staff and cross-site requests; returns the staff user', async () => {
    expect(((await requireStaff(payloadWith(null), request())) as Response).status).toBe(401)
    expect(
      ((await requireStaff(payloadWith({ id: 1, collection: 'customers' }), request())) as Response)
        .status,
    ).toBe(403)
    const staff = { id: 2, collection: 'users' }
    expect(
      (
        (await requireStaff(
          payloadWith(staff),
          request({ origin: 'https://evil.example' }),
        )) as Response
      ).status,
    ).toBe(403)
    expect(
      ((await requireStaff(payloadWith(staff), request({ origin: 'not a url' }))) as Response)
        .status,
    ).toBe(403)
    expect(
      await requireStaff(payloadWith(staff), request({ origin: 'http://localhost:3000' })),
    ).toBe(staff)
    expect(
      await requireStaff(
        payloadWith(staff),
        request({
          origin: 'https://ops.alphaaudios.com',
          'x-forwarded-host': 'ops.alphaaudios.com',
        }),
      ),
    ).toBe(staff)
  })
})

describe('parseBody', () => {
  const schema = z.object({ location: z.number() }).strict()
  it('parses JSON, treats an empty body as {}, and refuses bad JSON or shape', async () => {
    expect(await parseBody(request({}, '{"location":4}'), schema)).toEqual({ location: 4 })
    expect(await parseBody(request(), z.object({}).strict())).toEqual({})
    const bad = (await parseBody(request({}, '{'), schema)) as Response
    expect([bad.status, ((await bad.json()) as { error: { code: string } }).error.code]).toEqual([
      400,
      'invalid-json',
    ])
    const wrong = (await parseBody(request({}, '{"location":"A01"}'), schema)) as Response
    expect(wrong.status).toBe(400)
    expect(wrong.headers.get('cache-control')).toBe('private, no-store')
  })
})

describe('serviceError', () => {
  it('maps refusals to statuses and rethrows anything else', () => {
    expect(serviceError(new ReceivingError('receipt-not-found', 'x')).status).toBe(404)
    expect(serviceError(new ReceivingError('po-not-open', 'x')).status).toBe(409)
    expect(serviceError(new ReceivingError('serial-missing', 'x')).status).toBe(422)
    expect(serviceError(new LedgerError('insufficient-stock', 'x')).status).toBe(409)
    expect(() => serviceError(new Error('bug'))).toThrow('bug')
  })
})
