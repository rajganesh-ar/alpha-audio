import { randomBytes } from 'node:crypto'
import pg from 'pg'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'

/**
 * A throwaway Postgres database for one test file. The server comes from DATABASE_URL when
 * set (CI's pgvector service, or a local cluster), otherwise from Testcontainers (Docker).
 */
export interface TestDatabase {
  url: string
  drop: () => Promise<void>
}

async function onServer<T>(url: string, fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

export async function createTestDatabase(): Promise<TestDatabase> {
  let container: StartedPostgreSqlContainer | undefined
  let serverUrl = process.env['DATABASE_URL']
  if (!serverUrl) {
    container = await new PostgreSqlContainer('pgvector/pgvector:pg16').start()
    serverUrl = container.getConnectionUri()
  }
  const name = `alpha_test_${randomBytes(4).toString('hex')}`
  await onServer(serverUrl, (c) => c.query(`CREATE DATABASE ${name}`))
  const url = new URL(serverUrl)
  url.pathname = `/${name}`
  const admin = serverUrl
  return {
    url: url.toString(),
    drop: async () => {
      await onServer(admin, (c) => c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`))
      await container?.stop()
    },
  }
}
