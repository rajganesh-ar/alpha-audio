import config from '@payload-config'
import { getPayload } from 'payload'
import { postWebhook } from '@/lib/api/checkout'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
): Promise<Response> {
  return postWebhook({ payload: await getPayload({ config }) }, request, (await params).provider)
}
