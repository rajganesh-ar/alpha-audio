import config from '@payload-config'
import { getPayload } from 'payload'
import { postEnquiry } from '@/lib/api/leads'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ market: string }> },
): Promise<Response> {
  const { market } = await params
  return postEnquiry({ payload: await getPayload({ config }) }, request, market)
}
