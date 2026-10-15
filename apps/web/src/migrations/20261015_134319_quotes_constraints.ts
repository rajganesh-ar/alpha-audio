import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

/**
 * Database guarantees for dealer quotes (docs/tasks/0016):
 *  - quote numbers come from one sequence (`Q-AE-2026-000001`);
 *  - money is whole minor units, never negative, and gross = net + VAT;
 *  - each line's net is its unit times its quantity.
 * Hand-written: Payload's schema generator cannot express sequences or CHECKs.
 */
export async function up({ db }: Pick<MigrateUpArgs, 'db'>): Promise<void> {
  await db.execute(sql`
    CREATE SEQUENCE IF NOT EXISTS "quote_number_seq" START 1;
    ALTER TABLE "quotes"
      ADD CONSTRAINT "quotes_totals_minor_units" CHECK (
        "totals_net" >= 0 AND "totals_net" = trunc("totals_net")
        AND "totals_vat" >= 0 AND "totals_vat" = trunc("totals_vat")
        AND "totals_gross" = "totals_net" + "totals_vat"
      );
    ALTER TABLE "quotes_lines"
      ADD CONSTRAINT "quotes_lines_amounts" CHECK (
        "qty" > 0 AND "qty" = trunc("qty")
        AND ("unit_net" IS NULL OR ("unit_net" >= 0 AND "unit_net" = trunc("unit_net")
          AND "line_net" = "unit_net" * "qty"))
        AND ("vat" IS NULL OR ("vat" >= 0 AND "vat" = trunc("vat")))
      );
    CREATE INDEX IF NOT EXISTS "quotes_company_status_idx" ON "quotes" ("company_id", "status");
  `)
}

export async function down({ db }: Pick<MigrateDownArgs, 'db'>): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "quotes_company_status_idx";
    ALTER TABLE "quotes_lines" DROP CONSTRAINT IF EXISTS "quotes_lines_amounts";
    ALTER TABLE "quotes" DROP CONSTRAINT IF EXISTS "quotes_totals_minor_units";
    DROP SEQUENCE IF EXISTS "quote_number_seq";
  `)
}
