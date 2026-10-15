import config from '@payload-config'
import { getPayload } from 'payload'
import { postOrderAction } from '@/lib/api/opsOrders'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ number: string; action: string }> },
): Promise<Response> {
  const { number, action } = await params
  return postOrderAction({ payload: await getPayload({ config }) }, request, number, action)
}
