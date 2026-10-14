import config from '@payload-config'
import { getPayload } from 'payload'
import { putawayReceipt } from '@/lib/api/receipts'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return putawayReceipt(await getPayload({ config }), request, (await params).id)
}
