import { createReceiving } from '@alpha/payload'
import type { Payload } from 'payload'
import { z } from 'zod'
import { json, parseBody, problem, requireStaff, serviceError } from './respond'

/**
 * Ops endpoints for goods receipts (docs/tasks/0005). Thin: authenticate, validate, call the
 * receiving service, map its refusals. The receiving PWA calls these.
 */

const receiptId = z.coerce.number().int().positive()
const PostBody = z.object({}).strict()
const PutawayBody = z.object({ location: z.number().int().positive() }).strict()

export async function postReceipt(
  payload: Payload,
  request: Request,
  id: string,
): Promise<Response> {
  const staff = await requireStaff(payload, request)
  if (staff instanceof Response) return staff
  const receipt = receiptId.safeParse(id)
  if (!receipt.success) return problem(404, 'receipt-not-found', 'No such goods receipt.')
  const body = await parseBody(request, PostBody)
  if (body instanceof Response) return body
  try {
    return json(await createReceiving(payload).postReceipt(receipt.data, { user: staff.id }))
  } catch (error) {
    return serviceError(error)
  }
}

export async function putawayReceipt(
  payload: Payload,
  request: Request,
  id: string,
): Promise<Response> {
  const staff = await requireStaff(payload, request)
  if (staff instanceof Response) return staff
  const receipt = receiptId.safeParse(id)
  if (!receipt.success) return problem(404, 'receipt-not-found', 'No such goods receipt.')
  const body = await parseBody(request, PutawayBody)
  if (body instanceof Response) return body
  try {
    return json(
      await createReceiving(payload).putaway(receipt.data, {
        location: body.location,
        user: staff.id,
      }),
    )
  } catch (error) {
    return serviceError(error)
  }
}
