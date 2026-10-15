import { describe, expect, it } from 'vitest'
import { pageWindow } from './Pagination'

describe('pageWindow', () => {
  it('shows first, last and the neighbours of the current page, with gaps', () => {
    expect(pageWindow(1, 1)).toEqual([1])
    expect(pageWindow(1, 3)).toEqual([1, 2, 3])
    expect(pageWindow(5, 9)).toEqual([1, null, 4, 5, 6, null, 9])
    expect(pageWindow(2, 9)).toEqual([1, 2, 3, null, 9])
    expect(pageWindow(9, 9)).toEqual([1, null, 8, 9])
  })
})
