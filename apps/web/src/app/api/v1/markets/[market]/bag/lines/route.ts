import config from '@payload-config'
import { getPayload } from 'payload'
import { postBagLine } from '@/lib/api/bag'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ market: string }> },
): Promise<Response> {
  return postBagLine(await getPayload({ config }), request, (await params).market)
}
