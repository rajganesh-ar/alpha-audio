import { describe, expect, it } from 'vitest'
import { getDictionary, translator } from '@alpha/ui'
import { timeLeft } from './leadTime'

const t = translator(getDictionary('en'))
const now = new Date('2026-10-15T10:00:00Z')
const at = (h: number) => new Date(now.getTime() + h * 3600_000)

describe('timeLeft', () => {
  it('puts the deadline in words, urgent under two hours', () => {
    expect(timeLeft(at(23.9), now, t)).toEqual({ text: 'about 23 hours left', urgent: false })
    expect(timeLeft(at(1.5), now, t)).toEqual({ text: 'about 1 hours left', urgent: true })
    expect(timeLeft(at(0.5), now, t)).toEqual({ text: 'under an hour left', urgent: true })
    expect(timeLeft(at(-1), now, t)).toEqual({ text: 'time is up', urgent: true })
  })
})
