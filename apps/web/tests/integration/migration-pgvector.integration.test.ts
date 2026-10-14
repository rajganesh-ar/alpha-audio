import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { drizzle } from '@payloadcms/db-postgres/drizzle/node-postgres'
import { sql, type MigrateUpArgs } from '@payloadcms/db-postgres'
import pg from 'pg'
import { down, up } from '../../src/migrations/20261014_023807_pgvector'

/**
 * Integration: runs the real pgvector migration's `up` and `down` against a fresh database.
 *
 * Postgres comes from DATABASE_URL when set (CI's pgvector service container, or a local
 * cluster), otherwise from Testcontainers (needs Docker). Either way the test creates its own
 * throwaway database, so it never touches data and always starts without the extension.
 */
let container: StartedPostgreSqlContainer | undefined
let adminUrl: string
let testUrl: string
const testDb = `alpha_test_${randomBytes(4).toString('hex')}`

async function onAdmin<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: adminUrl })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

type MigrationDb = Pick<MigrateUpArgs, 'db'>['db']

/**
 * Opens the throwaway database through Drizzle's node-postgres driver, as Payload does.
 * Drizzle gets a connection string (not a `pg.Client`) so it owns its pool with the `pg`
 * version it was built against; no `pg` types cross package boundaries.
 */
async function withTestDb<T>(fn: (db: MigrationDb) => Promise<T>): Promise<T> {
  const drizzleDb = drizzle(testUrl)
  try {
    // reason: same runtime object Payload passes as `db`; the adapter's declared type only
    // adds Payload's schema generics, which a migration that runs raw SQL does not use.
    return await fn(drizzleDb as unknown as MigrationDb)
  } finally {
    await drizzleDb.$client.end()
  }
}

async function hasVector(db: MigrationDb): Promise<boolean> {
  const r = await db.execute(sql`SELECT 1 FROM pg_extension WHERE extname = 'vector'`)
  return r.rows.length === 1
}

beforeAll(async () => {
  const fromEnv = process.env['DATABASE_URL']
  if (fromEnv) {
    adminUrl = fromEnv
  } else {
    container = await new PostgreSqlContainer('pgvector/pgvector:pg16').start()
    adminUrl = container.getConnectionUri()
  }
  await onAdmin((c) => c.query(`CREATE DATABASE ${testDb}`))
  const u = new URL(adminUrl)
  u.pathname = `/${testDb}`
  testUrl = u.toString()
})

afterAll(async () => {
  if (adminUrl) await onAdmin((c) => c.query(`DROP DATABASE IF EXISTS ${testDb} WITH (FORCE)`))
  await container?.stop()
})

describe('migration 20261014_023807_pgvector', () => {
  it('starts on a database without the extension', async () => {
    await withTestDb(async (db) => {
      expect(await hasVector(db)).toBe(false)
    })
  })

  it('up() enables pgvector and vectors work', async () => {
    await withTestDb(async (db) => {
      await up({ db })
      expect(await hasVector(db)).toBe(true)
      const v = await db.execute(sql`SELECT '[1,2,3]'::vector AS v`)
      expect(String(v.rows[0]?.['v'])).toBe('[1,2,3]')
    })
  })

  it('up() is idempotent', async () => {
    await withTestDb(async (db) => {
      await up({ db })
      expect(await hasVector(db)).toBe(true)
    })
  })

  it('down() removes the extension', async () => {
    await withTestDb(async (db) => {
      await down({ db })
      expect(await hasVector(db)).toBe(false)
    })
  })
})
