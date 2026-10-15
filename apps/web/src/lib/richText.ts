/** Helpers over Payload's Lexical JSON (docs/tasks/0011). Pure, so they are unit tested. */

interface LexicalNode {
  type?: string
  tag?: string
  text?: string
  children?: LexicalNode[]
}

export const headingId = (index: number): string => `section-${index + 1}`

const textOf = (node: LexicalNode): string =>
  node.text ?? (node.children ?? []).map(textOf).join('')

/** The page's sections: every top-level h1/h2, in order, with the id the renderer gives it. */
export function headingsOf(data: unknown): Array<{ id: string; text: string }> {
  const root = (data as { root?: LexicalNode } | null)?.root
  return (root?.children ?? [])
    .filter((n) => n.type === 'heading' && (n.tag === 'h1' || n.tag === 'h2'))
    .map((n, i) => ({ id: headingId(i), text: textOf(n).trim() }))
}

/** Lexical JSON from plain sections, for seeds and tests: an h2 then its paragraphs. */
export function lexicalDocument(
  sections: ReadonlyArray<{ heading?: string; paragraphs: readonly string[] }>,
) {
  const text = (value: string) => ({
    type: 'text',
    text: value,
    format: 0,
    detail: 0,
    mode: 'normal',
    style: '',
    version: 1,
  })
  const block = (
    type: 'paragraph' | 'heading',
    value: string,
    extra: Record<string, unknown> = {},
  ) => ({
    type,
    children: [text(value)],
    direction: null,
    format: '',
    indent: 0,
    version: 1,
    ...extra,
  })
  return {
    root: {
      type: 'root',
      direction: null,
      format: '',
      indent: 0,
      version: 1,
      children: sections.flatMap((s) => [
        ...(s.heading ? [block('heading', s.heading, { tag: 'h2' })] : []),
        ...s.paragraphs.map((p) => block('paragraph', p, { textFormat: 0, textStyle: '' })),
      ]),
    },
  }
}
