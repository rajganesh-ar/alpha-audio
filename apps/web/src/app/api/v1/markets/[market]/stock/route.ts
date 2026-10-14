import { getStock } from '@/lib/api/stock'
import { getMarkets } from '@/lib/markets'
import { stockPromises } from '@/lib/stock'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ market: string }> },
): Promise<Response> {
  return getStock(request, (await params).market, { markets: getMarkets, promises: stockPromises })
}
