import type { MarketRoute } from '@alpha/payload'
import type { Brand, Category, Product } from '@/payload-types'
import { categoryTrail, getBrands, getCategories, getListingProducts } from './catalog'
import { brandOf, categoriesOf } from './productView'
import { getSaleRule, sellableBrands } from './rights'

/**
 * Brand index and brand page data (docs/tasks/0008): brands with live rights in the market,
 * and their products on sale there, grouped by top-level category.
 */
export interface BrandGroup {
  category: Category | null
  brands: Array<{ brand: Brand; count: number }>
}

export interface ProductFamily {
  category: Category | null
  products: Product[]
}

const topOf = (product: Product, categories: readonly Category[]): Category | null =>
  categoryTrail(categories, categoriesOf(product)[0]?.id)[0] ?? null

export async function brandsInMarket(route: MarketRoute) {
  const [brands, rights, categories, products, onSale] = await Promise.all([
    getBrands(route.locale),
    sellableBrands(route.market.code),
    getCategories(route.locale),
    getListingProducts(null, route.locale),
    getSaleRule(),
  ])
  const live = brands.filter((b) => rights.has(String(b.id)))
  const sold = products.filter((p) => onSale(p, route.market.code))
  return { live, sold, categories }
}

/** Live brands under each top-level category they sell in; brands with nothing on sale last. */
export async function brandIndex(route: MarketRoute): Promise<BrandGroup[]> {
  const { live, sold, categories } = await brandsInMarket(route)
  const counts = new Map<string, Map<number, number>>()
  for (const product of sold) {
    const brand = brandOf(product)
    const top = topOf(product, categories)
    if (!brand || !top) continue
    const byBrand = counts.get(String(top.id)) ?? new Map<number, number>()
    byBrand.set(brand.id, (byBrand.get(brand.id) ?? 0) + 1)
    counts.set(String(top.id), byBrand)
  }
  const groups: BrandGroup[] = categories
    .filter((c) => counts.has(String(c.id)))
    .map((category) => ({
      category,
      brands: live
        .filter((b) => counts.get(String(category.id))?.has(b.id))
        .map((brand) => ({ brand, count: counts.get(String(category.id))?.get(brand.id) ?? 0 })),
    }))
    .filter((g) => g.brands.length > 0)
  const listed = new Set(groups.flatMap((g) => g.brands.map((b) => b.brand.id)))
  const rest = live.filter((b) => !listed.has(b.id))
  return rest.length
    ? [...groups, { category: null, brands: rest.map((brand) => ({ brand, count: 0 })) }]
    : groups
}

/** A live brand and its products on sale in the market by family; null when it has no rights here. */
export async function brandPage(route: MarketRoute, slug: string) {
  const { live, sold, categories } = await brandsInMarket(route)
  const brand = live.find((b) => b.slug === slug)
  if (!brand) return null
  const mine = sold.filter((p) => brandOf(p)?.id === brand.id)
  const families: ProductFamily[] = []
  for (const product of mine) {
    const top = topOf(product, categories)
    const family = families.find((f) => f.category?.id === top?.id)
    if (family) family.products.push(product)
    else families.push({ category: top, products: [product] })
  }
  families.sort((a, b) => (a.category?.order ?? 1e9) - (b.category?.order ?? 1e9))
  return { brand, families, total: mine.length }
}

/** Markets where a brand holds live rights, for hreflang. */
export async function brandMarkets(
  brandId: number,
  markets: readonly MarketRoute['market'][],
): Promise<Set<string>> {
  const result = new Set<string>()
  for (const market of markets)
    if ((await sellableBrands(market.code)).has(String(brandId))) result.add(market.code)
  return result
}
