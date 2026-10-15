import { getLeads } from '@/lib/api'
import { deps } from '@/lib/deps'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return getLeads(await deps(), request)
}
