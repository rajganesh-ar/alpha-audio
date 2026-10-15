import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

/**
 * Database guarantees for fulfilment (docs/tasks/0010):
 *  - shipment numbers come from one sequence;
 *  - a refund amount is whole minor units, never negative, and never more than the order total.
 * Hand-written: Payload's schema generator cannot express sequences or CHECKs.
 */
export async function up({ db }: Pick<MigrateUpArgs, 'db'>): Promise<void> {
  await db.execute(sql`
    CREATE SEQUENCE IF NOT EXISTS "shipment_number_seq" START 1;
    ALTER TABLE "orders"
      ADD CONSTRAINT "orders_refund_amount" CHECK (
        "refund_amount" IS NULL OR (
          "refund_amount" >= 0 AND "refund_amount" = trunc("refund_amount")
          AND "refund_amount" <= "totals_total"
        )
      );
  `)
}

export async function down({ db }: Pick<MigrateDownArgs, 'db'>): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_refund_amount";
    DROP SEQUENCE IF EXISTS "shipment_number_seq";
  `)
}
