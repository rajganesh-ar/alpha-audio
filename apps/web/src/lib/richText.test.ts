import { describe, expect, it } from 'vitest'
import { headingsOf, lexicalDocument } from './richText'

describe('rich text helpers', () => {
  it('lists top-level headings with the ids the renderer gives them', () => {
    const doc = lexicalDocument([
      { paragraphs: ['Intro.'] },
      { heading: 'Who we are', paragraphs: ['A.'] },
      { heading: 'Your rights', paragraphs: ['B.', 'C.'] },
    ])
    expect(headingsOf(doc)).toEqual([
      { id: 'section-1', text: 'Who we are' },
      { id: 'section-2', text: 'Your rights' },
    ])
    expect(doc.root.children).toHaveLength(6)
  })

  it('tolerates missing or odd data', () => {
    expect(headingsOf(null)).toEqual([])
    expect(
      headingsOf({ root: { children: [{ type: 'heading', tag: 'h3', children: [] }] } }),
    ).toEqual([])
  })
})
