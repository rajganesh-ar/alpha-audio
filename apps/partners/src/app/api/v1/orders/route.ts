import { getOrders, postOrder } from '@/lib/api'
import { deps } from '@/lib/deps'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return getOrders(await deps(), request)
}

export async function POST(request: Request) {
  return postOrder(await deps(), request)
}
