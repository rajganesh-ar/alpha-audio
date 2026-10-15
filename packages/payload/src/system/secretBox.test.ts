import { describe, expect, it } from 'vitest'
import { open, seal } from './secretBox'

describe('secret box', () => {
  it('opens what it sealed, with the same secret only', () => {
    const box = seal({ secret: 'a' }, 'https://x/verify?token=abc')
    expect(box).not.toContain('token=abc')
    expect(open({ secret: 'a' }, box)).toBe('https://x/verify?token=abc')
    expect(open({ secret: 'b' }, box)).toBeNull()
    expect(seal({ secret: 'a' }, 'same')).not.toBe(seal({ secret: 'a' }, 'same'))
  })

  it('refuses tampered or malformed boxes', () => {
    const [iv, tag, body] = seal({ secret: 'a' }, 'hello').split('.')
    expect(open({ secret: 'a' }, [iv, tag, `${body}x`].join('.'))).toBeNull()
    expect(open({ secret: 'a' }, 'nope')).toBeNull()
  })
})
