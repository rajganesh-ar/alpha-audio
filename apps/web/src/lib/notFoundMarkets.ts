import { getMarkets } from './markets'

/** Markets for a 404 page. A 404 must render even when the database is unreachable. */
export async function marketsForNotFound() {
  try {
    return await getMarkets()
  } catch (error) {
    console.error('not_found_markets_unavailable', error)
    return []
  }
}
