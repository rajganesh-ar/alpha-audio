import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

/**
 * Database guarantees for checkout (docs/tasks/0009):
 *  - order numbers come from one sequence, so two checkouts can never share a number;
 *  - a webhook event is recorded once per provider (the replay check);
 *  - order money is whole minor units, never negative, and the total adds up.
 * Hand-written: Payload's schema generator cannot express sequences, CHECKs or this index.
 */
export async function up({ db }: Pick<MigrateUpArgs, 'db'>): Promise<void> {
  await db.execute(sql`
    CREATE SEQUENCE IF NOT EXISTS "order_number_seq" START 1;
    CREATE UNIQUE INDEX "webhook_events_provider_event_id_unique" ON "webhook_events" ("provider", "event_id");
    CREATE UNIQUE INDEX "orders_payment_intent_unique" ON "orders" ("payment_provider", "payment_intent_id") WHERE "payment_intent_id" IS NOT NULL;
    ALTER TABLE "orders"
      ADD CONSTRAINT "orders_totals_minor_units" CHECK (
        "totals_subtotal" >= 0 AND "totals_subtotal" = trunc("totals_subtotal")
        AND "totals_vat" >= 0 AND "totals_vat" = trunc("totals_vat")
        AND "totals_delivery" >= 0 AND "totals_delivery" = trunc("totals_delivery")
        AND "totals_total" = "totals_subtotal" + "totals_delivery"
      );
    ALTER TABLE "orders_lines"
      ADD CONSTRAINT "orders_lines_amounts" CHECK (
        "qty" > 0 AND "qty" = trunc("qty") AND "unit_price" >= 0 AND "unit_price" = trunc("unit_price")
        AND "line_total" = "unit_price" * "qty" AND "vat" >= 0 AND "vat" = trunc("vat")
      );
  `)
}

export async function down({ db }: Pick<MigrateDownArgs, 'db'>): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders_lines" DROP CONSTRAINT IF EXISTS "orders_lines_amounts";
    ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_totals_minor_units";
    DROP INDEX IF EXISTS "orders_payment_intent_unique";
    DROP INDEX IF EXISTS "webhook_events_provider_event_id_unique";
    DROP SEQUENCE IF EXISTS "order_number_seq";
  `)
}
