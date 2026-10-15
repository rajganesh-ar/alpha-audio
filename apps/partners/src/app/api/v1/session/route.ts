import { postSession } from '@/lib/api'
import { deps } from '@/lib/deps'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  return postSession(await deps(), request)
}
