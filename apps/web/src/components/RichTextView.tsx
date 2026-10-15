import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { RichText, type JSXConvertersFunction } from '@payloadcms/richtext-lexical/react'
import { headingId } from '@/lib/richText'

type Heading = { tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'; children?: unknown[] }

/**
 * Lexical rich text from Payload, styled with the tokens (logical properties only, so it reads
 * correctly in Arabic). Second-level headings get ids for the page's table of contents; page
 * headings start at h2 because the page title is the h1.
 */
export function RichTextView({ data }: { data: SerializedEditorState }) {
  let index = 0
  const converters: JSXConvertersFunction = ({ defaultConverters }) => ({
    ...defaultConverters,
    heading: ({ node, nodesToJSX }) => {
      const heading = node as unknown as Heading
      const children = nodesToJSX({ nodes: (heading.children ?? []) as never })
      if (heading.tag === 'h1' || heading.tag === 'h2') {
        return (
          <h2 id={headingId(index++)} className="scroll-mt-24">
            {children}
          </h2>
        )
      }
      const Tag = heading.tag
      return <Tag>{children}</Tag>
    },
  })
  return (
    <RichText
      data={data}
      converters={converters}
      className="flex max-w-prose flex-col gap-4 text-base leading-relaxed text-ink [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:ms-6 [&_ol]:list-decimal [&_ul]:list-disc"
    />
  )
}
