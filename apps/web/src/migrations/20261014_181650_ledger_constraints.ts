import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

/**
 * Database guarantees for the stock ledger, so the rules hold even for code that bypasses the
 * application (a psql session, a future script):
 *  - stock_movements is insert-only: UPDATE, DELETE and TRUNCATE raise an error;
 *  - levels are whole numbers and never below zero; movements move a positive whole quantity,
 *    change state, and a serialised movement moves exactly one unit;
 *  - reservations hold a positive whole quantity.
 * Hand-written: Payload's schema generator cannot express CHECK constraints or triggers.
 */
export async function up({ db }: Pick<MigrateUpArgs, 'db'>): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "stock_levels"
      ADD CONSTRAINT "stock_levels_qty_whole_non_negative" CHECK ("qty" >= 0 AND "qty" = trunc("qty"));

    ALTER TABLE "stock_movements"
      ADD CONSTRAINT "stock_movements_qty_whole_positive" CHECK ("qty" > 0 AND "qty" = trunc("qty")),
      ADD CONSTRAINT "stock_movements_changes_state" CHECK (
        ("from_state" IS NOT NULL OR "to_state" IS NOT NULL)
        AND "from_state"::text IS DISTINCT FROM "to_state"::text
      ),
      ADD CONSTRAINT "stock_movements_serial_single_unit" CHECK ("serial" IS NULL OR "qty" = 1);

    ALTER TABLE "reservations"
      ADD CONSTRAINT "reservations_qty_whole_positive" CHECK ("qty" > 0 AND "qty" = trunc("qty"));

    CREATE FUNCTION "alpha_refuse_stock_movement_change"() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'stock_movements is insert-only (% refused)', TG_OP USING ERRCODE = 'insufficient_privilege';
    END
    $$;

    CREATE TRIGGER "stock_movements_insert_only"
      BEFORE UPDATE OR DELETE ON "stock_movements"
      FOR EACH ROW EXECUTE FUNCTION "alpha_refuse_stock_movement_change"();

    CREATE TRIGGER "stock_movements_no_truncate"
      BEFORE TRUNCATE ON "stock_movements"
      FOR EACH STATEMENT EXECUTE FUNCTION "alpha_refuse_stock_movement_change"();
  `)
}

export async function down({ db }: Pick<MigrateDownArgs, 'db'>): Promise<void> {
  await db.execute(sql`
    DROP TRIGGER IF EXISTS "stock_movements_no_truncate" ON "stock_movements";
    DROP TRIGGER IF EXISTS "stock_movements_insert_only" ON "stock_movements";
    DROP FUNCTION IF EXISTS "alpha_refuse_stock_movement_change"();
    ALTER TABLE "reservations" DROP CONSTRAINT IF EXISTS "reservations_qty_whole_positive";
    ALTER TABLE "stock_movements"
      DROP CONSTRAINT IF EXISTS "stock_movements_serial_single_unit",
      DROP CONSTRAINT IF EXISTS "stock_movements_changes_state",
      DROP CONSTRAINT IF EXISTS "stock_movements_qty_whole_positive";
    ALTER TABLE "stock_levels" DROP CONSTRAINT IF EXISTS "stock_levels_qty_whole_non_negative";
  `)
}
