import { getQuotes, postQuote } from '@/lib/api'
import { deps } from '@/lib/deps'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return getQuotes(await deps(), request)
}

export async function POST(request: Request) {
  return postQuote(await deps(), request)
}
