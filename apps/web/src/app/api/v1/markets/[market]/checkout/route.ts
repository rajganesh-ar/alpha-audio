import config from '@payload-config'
import { getPayload } from 'payload'
import { postCheckout } from '@/lib/api/checkout'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ market: string }> },
): Promise<Response> {
  return postCheckout({ payload: await getPayload({ config }) }, request, (await params).market)
}
