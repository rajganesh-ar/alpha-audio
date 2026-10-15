import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_trade_orders_status" AS ENUM('reserving', 'unavailable', 'pending-approval', 'approving', 'confirmed', 'rejected', 'cancelled', 'failed');
  CREATE TYPE "public"."enum_trade_orders_market" AS ENUM('ae', 'sa', 'qa', 'kw', 'bh', 'om');
  CREATE TYPE "public"."enum_trade_orders_failure_reason" AS ENUM('stock-lost');
  CREATE TABLE "trade_orders_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer,
  	"sku" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"qty" numeric NOT NULL,
  	"unit_net" numeric,
  	"line_net" numeric,
  	"vat" numeric,
  	"basis" varchar,
  	"price_status" varchar,
  	"trace" jsonb
  );
  
  CREATE TABLE "trade_orders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" varchar NOT NULL,
  	"status" "enum_trade_orders_status" NOT NULL,
  	"company_id" integer NOT NULL,
  	"placed_by_id" integer NOT NULL,
  	"market" "enum_trade_orders_market" NOT NULL,
  	"currency" varchar NOT NULL,
  	"decimals" numeric NOT NULL,
  	"vat_rate" numeric NOT NULL,
  	"po_number" varchar,
  	"note" varchar,
  	"totals_net" numeric,
  	"totals_vat" numeric,
  	"totals_gross" numeric,
  	"approvals" jsonb,
  	"failure_reason" "enum_trade_orders_failure_reason",
  	"closed_reason" varchar,
  	"hold_expires_at" timestamp(3) with time zone,
  	"reservations" jsonb,
  	"unavailable_skus" jsonb,
  	"idempotency_key" varchar NOT NULL,
  	"staff_notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "trade_orders_id" integer;
  ALTER TABLE "trade_orders_lines" ADD CONSTRAINT "trade_orders_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "trade_orders_lines" ADD CONSTRAINT "trade_orders_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_orders" ADD CONSTRAINT "trade_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "trade_orders" ADD CONSTRAINT "trade_orders_placed_by_id_company_users_id_fk" FOREIGN KEY ("placed_by_id") REFERENCES "public"."company_users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "trade_orders_lines_order_idx" ON "trade_orders_lines" USING btree ("_order");
  CREATE INDEX "trade_orders_lines_parent_id_idx" ON "trade_orders_lines" USING btree ("_parent_id");
  CREATE INDEX "trade_orders_lines_product_idx" ON "trade_orders_lines" USING btree ("product_id");
  CREATE UNIQUE INDEX "trade_orders_number_idx" ON "trade_orders" USING btree ("number");
  CREATE INDEX "trade_orders_status_idx" ON "trade_orders" USING btree ("status");
  CREATE INDEX "trade_orders_company_idx" ON "trade_orders" USING btree ("company_id");
  CREATE INDEX "trade_orders_placed_by_idx" ON "trade_orders" USING btree ("placed_by_id");
  CREATE UNIQUE INDEX "trade_orders_idempotency_key_idx" ON "trade_orders" USING btree ("idempotency_key");
  CREATE INDEX "trade_orders_updated_at_idx" ON "trade_orders" USING btree ("updated_at");
  CREATE INDEX "trade_orders_created_at_idx" ON "trade_orders" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_trade_orders_fk" FOREIGN KEY ("trade_orders_id") REFERENCES "public"."trade_orders"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_trade_orders_id_idx" ON "payload_locked_documents_rels" USING btree ("trade_orders_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "trade_orders_lines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "trade_orders" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "trade_orders_lines" CASCADE;
  DROP TABLE "trade_orders" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_trade_orders_fk";
  
  DROP INDEX "payload_locked_documents_rels_trade_orders_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "trade_orders_id";
  DROP TYPE "public"."enum_trade_orders_status";
  DROP TYPE "public"."enum_trade_orders_market";
  DROP TYPE "public"."enum_trade_orders_failure_reason";`)
}
