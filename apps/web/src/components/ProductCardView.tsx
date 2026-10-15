import Image from 'next/image'
import type { StockPromise } from '@alpha/core'
import type { MarketRoute } from '@alpha/payload'
import { PriceBlock, ProductCard, getDictionary, translator } from '@alpha/ui'
import type { Product } from '@/payload-types'
import { LiveStockLine } from './LiveStockLine'
import {
  brandOf,
  liveStock,
  numberLocale,
  priceOf,
  productImages,
  productPath,
  stockLabels,
} from '@/lib/productView'

/** A Payload product as a `ProductCard`: lead image, brand, price incl. VAT, live stock line. */
export function ProductCardView({
  product,
  route,
  stock,
  headingLevel = 3,
  image: loading = 'lazy',
}: {
  product: Product
  route: MarketRoute
  stock: StockPromise | undefined
  headingLevel?: 2 | 3 | undefined
  /** `lcp` for the first card of a listing (the LCP on mobile), `eager` for the rest of its row. */
  image?: 'lcp' | 'eager' | 'lazy' | undefined
}) {
  const t = translator(getDictionary(route.locale))
  const price = priceOf(product, route)
  const image = productImages(product)[0]
  return (
    <ProductCard
      title={product.title}
      brand={brandOf(product)?.name}
      href={productPath(route, product.slug)}
      headingLevel={headingLevel}
      media={
        image ? (
          <Image
            src={image.url}
            alt={image.alt}
            fill
            sizes="(min-width: 64rem) 22vw, 100vw"
            {...(loading === 'lcp'
              ? { priority: true, fetchPriority: 'high' as const }
              : { loading: loading === 'eager' ? ('eager' as const) : ('lazy' as const) })}
          />
        ) : undefined
      }
      price={
        <PriceBlock
          locale={route.languageTag}
          price={price.kind === 'priced' ? price.price : null}
          vatLabel={
            price.kind === 'priced' ? t('price.inclVat', { rate: price.vatRate }) : undefined
          }
          requestLabel={t('price.onRequest')}
        />
      }
      stock={
        <LiveStockLine
          market={route.market.code}
          sku={product.sku}
          initial={liveStock(stock)}
          labels={stockLabels(t)}
          dateLocale={numberLocale(route)}
          timeZone={route.market.timezone}
        />
      }
    />
  )
}
