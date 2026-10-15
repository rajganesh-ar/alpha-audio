import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

/**
 * Database guarantees for leads (docs/tasks/0018):
 *  - lead numbers come from one sequence (`L-AE-2026-000001`);
 *  - an offered lead has a company and a deadline; a won value is whole minor units.
 * Hand-written: Payload's schema generator cannot express sequences or CHECKs.
 */
export async function up({ db }: Pick<MigrateUpArgs, 'db'>): Promise<void> {
  await db.execute(sql`
    CREATE SEQUENCE IF NOT EXISTS "lead_number_seq" START 1;
    ALTER TABLE "leads"
      ADD CONSTRAINT "leads_offer_complete" CHECK (
        "status" <> 'offered' OR ("offered_to_id" IS NOT NULL AND "accept_by" IS NOT NULL)
      ),
      ADD CONSTRAINT "leads_value_minor_units" CHECK (
        "value" IS NULL OR ("value" >= 0 AND "value" = trunc("value"))
      );
  `)
}

export async function down({ db }: Pick<MigrateDownArgs, 'db'>): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_value_minor_units";
    ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_offer_complete";
    DROP SEQUENCE IF EXISTS "lead_number_seq";
  `)
}
