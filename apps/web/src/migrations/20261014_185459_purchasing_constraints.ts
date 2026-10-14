import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

/**
 * Database guarantees for purchasing and receiving (docs/tasks/0005):
 *  - order and receipt quantities are whole numbers; costs are whole minor units;
 *  - a posted goods receipt is a ledger document: its lines never change and the receipt itself
 *    only gains its put-away stamp, once. Deleting a posted receipt is refused.
 * Hand-written: Payload's schema generator cannot express CHECK constraints or triggers.
 */
export async function up({ db }: Pick<MigrateUpArgs, 'db'>): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "purchase_orders_lines"
      ADD CONSTRAINT "purchase_orders_lines_qty_ordered_whole_positive" CHECK ("qty_ordered" > 0 AND "qty_ordered" = trunc("qty_ordered")),
      ADD CONSTRAINT "purchase_orders_lines_qty_received_whole" CHECK ("qty_received" IS NULL OR ("qty_received" >= 0 AND "qty_received" = trunc("qty_received"))),
      ADD CONSTRAINT "purchase_orders_lines_unit_cost_minor_units" CHECK ("unit_cost" >= 0 AND "unit_cost" = trunc("unit_cost"));

    ALTER TABLE "goods_receipts_lines"
      ADD CONSTRAINT "goods_receipts_lines_qty_whole_positive" CHECK ("qty" > 0 AND "qty" = trunc("qty"));

    ALTER TABLE "goods_receipts"
      ADD CONSTRAINT "goods_receipts_posted_stamped" CHECK ("status" <> 'posted' OR "posted_at" IS NOT NULL),
      ADD CONSTRAINT "goods_receipts_putaway_after_post" CHECK ("putaway_at" IS NULL OR "status" = 'posted');

    CREATE FUNCTION "alpha_freeze_posted_receipt"() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD."status" <> 'posted' THEN
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
      END IF;
      IF TG_OP = 'UPDATE'
        AND NEW."status" = OLD."status"
        AND NEW."number" = OLD."number"
        AND NEW."purchase_order_id" = OLD."purchase_order_id"
        AND NEW."location_id" = OLD."location_id"
        AND NEW."posted_at" = OLD."posted_at"
        AND NEW."posted_by_id" IS NOT DISTINCT FROM OLD."posted_by_id"
        AND (
          (NEW."putaway_at" IS NOT DISTINCT FROM OLD."putaway_at" AND NEW."putaway_location_id" IS NOT DISTINCT FROM OLD."putaway_location_id")
          OR (OLD."putaway_at" IS NULL AND NEW."putaway_at" IS NOT NULL AND NEW."putaway_location_id" IS NOT NULL)
        )
      THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'goods receipt % is posted (% refused)', OLD."number", TG_OP USING ERRCODE = 'insufficient_privilege';
    END
    $$;

    CREATE TRIGGER "goods_receipts_freeze_posted"
      BEFORE UPDATE OR DELETE ON "goods_receipts"
      FOR EACH ROW EXECUTE FUNCTION "alpha_freeze_posted_receipt"();

    CREATE FUNCTION "alpha_freeze_posted_receipt_lines"() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE
      receipt integer;
    BEGIN
      IF TG_TABLE_NAME = 'goods_receipts_lines' THEN
        receipt := CASE WHEN TG_OP = 'INSERT' THEN NEW."_parent_id" ELSE OLD."_parent_id" END;
      ELSE
        SELECT l."_parent_id" INTO receipt FROM "goods_receipts_lines" l
          WHERE l."id" = CASE WHEN TG_OP = 'INSERT' THEN NEW."_parent_id" ELSE OLD."_parent_id" END;
      END IF;
      IF EXISTS (SELECT 1 FROM "goods_receipts" r WHERE r."id" = receipt AND r."status" = 'posted') THEN
        RAISE EXCEPTION 'goods receipt lines are frozen once posted (% refused)', TG_OP USING ERRCODE = 'insufficient_privilege';
      END IF;
      RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END
    $$;

    CREATE TRIGGER "goods_receipts_lines_freeze_posted"
      BEFORE INSERT OR UPDATE OR DELETE ON "goods_receipts_lines"
      FOR EACH ROW EXECUTE FUNCTION "alpha_freeze_posted_receipt_lines"();

    CREATE TRIGGER "goods_receipts_lines_exceptions_freeze_posted"
      BEFORE INSERT OR UPDATE OR DELETE ON "goods_receipts_lines_exceptions"
      FOR EACH ROW EXECUTE FUNCTION "alpha_freeze_posted_receipt_lines"();
  `)
}

export async function down({ db }: Pick<MigrateDownArgs, 'db'>): Promise<void> {
  await db.execute(sql`
    DROP TRIGGER IF EXISTS "goods_receipts_lines_exceptions_freeze_posted" ON "goods_receipts_lines_exceptions";
    DROP TRIGGER IF EXISTS "goods_receipts_lines_freeze_posted" ON "goods_receipts_lines";
    DROP FUNCTION IF EXISTS "alpha_freeze_posted_receipt_lines"();
    DROP TRIGGER IF EXISTS "goods_receipts_freeze_posted" ON "goods_receipts";
    DROP FUNCTION IF EXISTS "alpha_freeze_posted_receipt"();
    ALTER TABLE "goods_receipts"
      DROP CONSTRAINT IF EXISTS "goods_receipts_putaway_after_post",
      DROP CONSTRAINT IF EXISTS "goods_receipts_posted_stamped";
    ALTER TABLE "goods_receipts_lines" DROP CONSTRAINT IF EXISTS "goods_receipts_lines_qty_whole_positive";
    ALTER TABLE "purchase_orders_lines"
      DROP CONSTRAINT IF EXISTS "purchase_orders_lines_unit_cost_minor_units",
      DROP CONSTRAINT IF EXISTS "purchase_orders_lines_qty_received_whole",
      DROP CONSTRAINT IF EXISTS "purchase_orders_lines_qty_ordered_whole_positive";
  `)
}
