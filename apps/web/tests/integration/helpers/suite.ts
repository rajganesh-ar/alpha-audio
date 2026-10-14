import type { Payload } from 'payload'
import { afterAll, beforeAll } from 'vitest'
import { createTestDatabase, type TestDatabase } from './database'
import { bootPayload } from './payload'

/**
 * Boots Payload on a fresh, migrated database for one test file and tears it down after.
 * `get()` returns the instance inside tests.
 */
export function usePayload(): () => Payload {
  let db: TestDatabase | undefined
  let payload: Payload | undefined
  beforeAll(async () => {
    db = await createTestDatabase()
    payload = await bootPayload(db.url)
  })
  afterAll(async () => {
    // Payload's destroy() leaves the pg pool open; DROP … WITH (FORCE) terminates its
    // connections, which the pool reports as errors that are expected here.
    // reason: the Postgres adapter keeps its pg Pool on `pool`; the base adapter type omits it
    const pool = (payload?.db as unknown as { pool?: import('pg').Pool } | undefined)?.pool
    pool?.on('error', () => {})
    await payload?.destroy()
    await db?.drop()
    await Promise.race([pool?.end(), new Promise((resolve) => setTimeout(resolve, 2_000))])
  })
  return () => {
    if (!payload) throw new Error('Payload is not booted yet')
    return payload
  }
}
