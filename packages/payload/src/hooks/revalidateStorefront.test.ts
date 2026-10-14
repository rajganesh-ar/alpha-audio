import { describe, expect, it, vi } from 'vitest'

const revalidateTag = vi.fn()
vi.mock('next/cache', () => ({ revalidateTag }))
const { revalidateStorefront, revalidateStorefrontGlobal } = await import('./revalidateStorefront')

const req = (context: Record<string, unknown> = {}) => {
  const error = vi.fn()
  return { req: { context, payload: { logger: { error } } }, error }
}
type Args = Parameters<ReturnType<typeof revalidateStorefront>['afterChange']>[0]

describe('revalidateStorefront', () => {
  it('expires every tag immediately and returns the document', async () => {
    revalidateTag.mockReset()
    const { req: r } = req()
    const doc = { id: 1 }
    expect(
      await revalidateStorefront('catalog', 'home').afterChange({ doc, req: r } as unknown as Args),
    ).toBe(doc)
    expect(revalidateTag.mock.calls).toEqual([
      ['catalog', { expire: 0 }],
      ['home', { expire: 0 }],
    ])
  })

  it('skips when the caller disables it, and outside a Next.js request', async () => {
    revalidateTag.mockReset()
    await revalidateStorefront('catalog').afterDelete({
      doc: {},
      req: req({ disableRevalidate: true }).req,
    } as never)
    expect(revalidateTag).not.toHaveBeenCalled()
    revalidateTag.mockImplementation(() => {
      throw new Error('Invariant: static generation store missing in revalidateTag("home")')
    })
    const { req: r, error } = req()
    await expect(revalidateStorefrontGlobal('home')({ doc: {}, req: r } as never)).resolves.toEqual(
      {},
    )
    expect(error).not.toHaveBeenCalled()
  })

  it('logs, but does not fail the save, on any other error', async () => {
    revalidateTag.mockImplementation(() => {
      throw new Error('boom')
    })
    const { req: r, error } = req()
    await expect(
      revalidateStorefront('catalog').afterChange({ doc: { id: 2 }, req: r } as unknown as Args),
    ).resolves.toEqual({ id: 2 })
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['catalog'] }),
      'storefront_revalidate_failed',
    )
  })
})
