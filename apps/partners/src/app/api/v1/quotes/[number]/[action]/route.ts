import { postQuoteAction } from '@/lib/api'
import { deps } from '@/lib/deps'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ number: string; action: string }> },
) {
  const { number, action } = await params
  return postQuoteAction(await deps(), request, number, action)
}
