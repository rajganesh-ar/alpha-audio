import config from '@payload-config'
import { getPayload } from 'payload'
import { postReceipt } from '@/lib/api/receipts'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return postReceipt(await getPayload({ config }), request, (await params).id)
}
