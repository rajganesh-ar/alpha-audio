import config from '@payload-config'
import { getPayload } from 'payload'
import { postSandboxPayment } from '@/lib/api/checkout'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ market: string; intent: string }> },
): Promise<Response> {
  return postSandboxPayment(
    { payload: await getPayload({ config }) },
    request,
    (await params).intent,
  )
}
