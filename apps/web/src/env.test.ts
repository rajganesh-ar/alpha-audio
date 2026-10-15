import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { envSchema, loadEnv } from '@alpha/config/env'

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const appRoot = fileURLToPath(new URL('../', import.meta.url))

function exampleKeys(file: string): string[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('=')[0] ?? '')
    .sort()
}

const good = {
  DATABASE_URL: 'postgres://a:b@localhost:5432/alpha',
  PAYLOAD_SECRET: 'x'.repeat(64),
  NEXT_PUBLIC_SERVER_URL: 'http://localhost:3000',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'alpha-media',
  S3_ACCESS_KEY_ID: 'k',
  S3_SECRET_ACCESS_KEY: 's',
  S3_FORCE_PATH_STYLE: 'true',
}

describe('loadEnv', () => {
  it('parses a complete environment', () => {
    const env = loadEnv(good)
    expect(env.S3_FORCE_PATH_STYLE).toBe(true)
    expect(env.NODE_ENV).toBe('development')
  })
  it('fails fast on a missing variable', () => {
    const missing: Record<string, string> = { ...good }
    delete missing['DATABASE_URL']
    expect(() => loadEnv(missing)).toThrow(/DATABASE_URL/)
  })
  it('rejects a short secret', () => {
    expect(() => loadEnv({ ...good, PAYLOAD_SECRET: 'short' })).toThrow(/PAYLOAD_SECRET/)
  })
})

describe('.env.example', () => {
  const rootExample = `${repoRoot}.env.example`
  const appExample = `${appRoot}.env.example`

  // Set by the runtime (next dev, next build, vitest), never by .env: a NODE_ENV=development
  // line sourced before `next build` breaks prerendering.
  const RUNTIME_MANAGED = ['NODE_ENV']

  it('documents every variable the schema reads, except runtime-managed ones', () => {
    const expected = Object.keys(envSchema.shape)
      .filter((k) => !RUNTIME_MANAGED.includes(k))
      .sort()
    expect(exampleKeys(rootExample)).toEqual(expected)
  })

  it('never sets a runtime-managed variable', () => {
    for (const key of RUNTIME_MANAGED) expect(exampleKeys(rootExample)).not.toContain(key)
  })

  it('apps/web copy is identical to the root copy (Next.js and the Payload CLI load it from apps/web)', () => {
    expect(readFileSync(appExample, 'utf8')).toBe(readFileSync(rootExample, 'utf8'))
  })

  it('apps/partners copy is identical too (the dealer board reads the same variables)', () => {
    expect(readFileSync(`${repoRoot}apps/partners/.env.example`, 'utf8')).toBe(
      readFileSync(rootExample, 'utf8'),
    )
  })
})
