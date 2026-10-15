import config from '@payload-config'
import { after } from 'next/server'
import { getPayload } from 'payload'
import { postVerify } from '@/lib/api/account'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ market: string }> },
): Promise<Response> {
  return postVerify(
    { payload: await getPayload({ config }), defer: (work) => after(work) },
    request,
    (await params).market,
  )
}
