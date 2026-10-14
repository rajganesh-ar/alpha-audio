import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

/**
 * Database guarantees for the catalogue (docs/tasks/0006), on the live tables only (drafts in
 * the version tables may be incomplete):
 *  - a price is a positive whole number of minor units; cost is a whole number;
 *  - a product has at most one row per market.
 * Hand-written: Payload's schema generator cannot express CHECK constraints or partial indexes.
 */
export async function up({ db }: Pick<MigrateUpArgs, 'db'>): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products_markets"
      ADD CONSTRAINT "products_markets_rrp_minor_units" CHECK ("rrp_incl_vat" IS NULL OR ("rrp_incl_vat" > 0 AND "rrp_incl_vat" = trunc("rrp_incl_vat")));
    CREATE UNIQUE INDEX "products_markets_one_row_per_market" ON "products_markets" ("_parent_id", "market") WHERE "market" IS NOT NULL;
    ALTER TABLE "products"
      ADD CONSTRAINT "products_cost_minor_units" CHECK ("cost" IS NULL OR ("cost" >= 0 AND "cost" = trunc("cost")));
  `)
}

export async function down({ db }: Pick<MigrateDownArgs, 'db'>): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_cost_minor_units";
    DROP INDEX IF EXISTS "products_markets_one_row_per_market";
    ALTER TABLE "products_markets" DROP CONSTRAINT IF EXISTS "products_markets_rrp_minor_units";
  `)
}
