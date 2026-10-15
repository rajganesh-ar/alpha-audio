import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

/**
 * Database guarantees for project registrations (docs/tasks/0017):
 *  - registration numbers come from one sequence (`P-AE-2026-000001`);
 *  - quantities are whole and positive, project prices whole minor units, never negative.
 * Hand-written: Payload's schema generator cannot express sequences or CHECKs.
 */
export async function up({ db }: Pick<MigrateUpArgs, 'db'>): Promise<void> {
  await db.execute(sql`
    CREATE SEQUENCE IF NOT EXISTS "project_number_seq" START 1;
    ALTER TABLE "project_registrations_lines"
      ADD CONSTRAINT "project_registrations_lines_amounts" CHECK (
        "qty" > 0 AND "qty" = trunc("qty")
        AND ("project_price" IS NULL OR ("project_price" >= 0 AND "project_price" = trunc("project_price")))
      );
    CREATE INDEX IF NOT EXISTS "project_registrations_company_status_idx"
      ON "project_registrations" ("company_id", "status");
  `)
}

export async function down({ db }: Pick<MigrateDownArgs, 'db'>): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "project_registrations_company_status_idx";
    ALTER TABLE "project_registrations_lines" DROP CONSTRAINT IF EXISTS "project_registrations_lines_amounts";
    DROP SEQUENCE IF EXISTS "project_number_seq";
  `)
}
