import { getCatalogue } from '@/lib/api'
import { deps } from '@/lib/deps'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return getCatalogue(await deps(), request)
}
