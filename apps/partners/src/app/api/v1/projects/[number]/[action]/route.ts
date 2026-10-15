import { postProjectAction } from '@/lib/api'
import { deps } from '@/lib/deps'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ number: string; action: string }> },
) {
  const { number, action } = await params
  return postProjectAction(await deps(), request, number, action)
}
