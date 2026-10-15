import config from '@payload-config'
import { getPayload } from 'payload'
import { postProjectDecision } from '@/lib/api/opsProjects'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ number: string; action: string }> },
): Promise<Response> {
  const { number, action } = await params
  return postProjectDecision({ payload: await getPayload({ config }) }, request, number, action)
}
