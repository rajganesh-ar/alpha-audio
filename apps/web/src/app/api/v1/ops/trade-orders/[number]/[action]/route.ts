import config from '@payload-config'
import { getPayload } from 'payload'
import { postTradeOrderAction } from '@/lib/api/opsTradeOrders'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ number: string; action: string }> },
): Promise<Response> {
  const { number, action } = await params
  return postTradeOrderAction({ payload: await getPayload({ config }) }, request, number, action)
}
