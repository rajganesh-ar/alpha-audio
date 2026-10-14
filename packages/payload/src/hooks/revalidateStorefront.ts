import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  GlobalAfterChangeHook,
  PayloadRequest,
} from 'payload'

/** Cache tags the storefront's data loaders use (apps/web/src/lib/catalog.ts). */
export const STOREFRONT_TAGS = {
  /** Products, brands and categories: product pages and product cards. */
  catalog: 'catalog',
  /** The Home global. */
  home: 'home',
} as const

export type StorefrontTag = (typeof STOREFRONT_TAGS)[keyof typeof STOREFRONT_TAGS]

/**
 * Expires the tags. Never fails the save: the document is already written, and the storefront
 * caches also expire on their own within five minutes (apps/web/src/lib/catalog.ts).
 *
 * Outside a Next.js request (seeds, `payload run`, jobs, tests) Next has no cache to expire and
 * throws an invariant; that case is expected and skipped. Seeds may also pass
 * `context.disableRevalidate` to skip the import altogether.
 */
async function expire(tags: readonly StorefrontTag[], req: PayloadRequest) {
  if (req.context['disableRevalidate']) return
  try {
    const { revalidateTag } = await import('next/cache')
    // `{ expire: 0 }`: the next request renders fresh. The default profile would serve stale
    // once, which would keep an unpublished product on sale for a request.
    for (const tag of tags) revalidateTag(tag, { expire: 0 })
  } catch (error) {
    if (error instanceof Error && error.message.includes('static generation store missing')) return
    req.payload.logger.error({ err: error, tags }, 'storefront_revalidate_failed')
  }
}

/** Expires the storefront pages that render a collection's documents. */
export const revalidateStorefront = (...tags: StorefrontTag[]) => {
  const afterChange: CollectionAfterChangeHook = async ({ doc, req }) => {
    await expire(tags, req)
    return doc
  }
  const afterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
    await expire(tags, req)
    return doc
  }
  return { afterChange, afterDelete }
}

/** The same for a global. */
export const revalidateStorefrontGlobal =
  (...tags: StorefrontTag[]): GlobalAfterChangeHook =>
  async ({ doc, req }) => {
    await expire(tags, req)
    return doc
  }
