import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * Enables pgvector so later migrations can add vector(1536) columns for embeddings.
 * Typed against `db` only: Payload passes the full args, and the integration test can run the
 * real migration with just a Drizzle handle.
 */
export async function up({ db }: Pick<MigrateUpArgs, 'db'>): Promise<void> {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`)
}

export async function down({ db }: Pick<MigrateDownArgs, 'db'>): Promise<void> {
  await db.execute(sql`DROP EXTENSION IF EXISTS vector;`)
}
