import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_purchase_orders_status" AS ENUM('draft', 'ordered', 'partially_received', 'received', 'closed', 'cancelled');
  CREATE TYPE "public"."enum_goods_receipts_lines_exceptions_type" AS ENUM('short', 'over', 'damaged', 'wrong_item', 'missing_serial');
  CREATE TYPE "public"."enum_goods_receipts_status" AS ENUM('draft', 'posted');
  CREATE TABLE "suppliers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"country" varchar NOT NULL,
  	"currency" varchar NOT NULL,
  	"lead_time_days" numeric DEFAULT 30,
  	"contact_name" varchar,
  	"contact_email" varchar,
  	"contact_phone" varchar,
  	"active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "purchase_orders_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"sku" varchar NOT NULL,
  	"description" varchar,
  	"qty_ordered" numeric NOT NULL,
  	"unit_cost" numeric NOT NULL,
  	"serialised" boolean DEFAULT false,
  	"qty_received" numeric DEFAULT 0
  );
  
  CREATE TABLE "purchase_orders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" varchar NOT NULL,
  	"supplier_id" integer NOT NULL,
  	"warehouse_id" integer NOT NULL,
  	"currency" varchar NOT NULL,
  	"decimals" numeric NOT NULL,
  	"expected_at" timestamp(3) with time zone,
  	"status" "enum_purchase_orders_status" DEFAULT 'draft' NOT NULL,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "goods_receipts_lines_exceptions" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "enum_goods_receipts_lines_exceptions_type" NOT NULL,
  	"qty" numeric,
  	"serials" jsonb,
  	"note" varchar
  );
  
  CREATE TABLE "goods_receipts_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"po_line" varchar NOT NULL,
  	"sku" varchar NOT NULL,
  	"qty" numeric NOT NULL,
  	"serials" jsonb
  );
  
  CREATE TABLE "goods_receipts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" varchar NOT NULL,
  	"purchase_order_id" integer NOT NULL,
  	"location_id" integer NOT NULL,
  	"status" "enum_goods_receipts_status" DEFAULT 'draft' NOT NULL,
  	"posted_at" timestamp(3) with time zone,
  	"posted_by_id" integer,
  	"putaway_at" timestamp(3) with time zone,
  	"putaway_location_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "suppliers_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "purchase_orders_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "goods_receipts_id" integer;
  ALTER TABLE "purchase_orders_lines" ADD CONSTRAINT "purchase_orders_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "goods_receipts_lines_exceptions" ADD CONSTRAINT "goods_receipts_lines_exceptions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."goods_receipts_lines"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "goods_receipts_lines" ADD CONSTRAINT "goods_receipts_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."goods_receipts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_posted_by_id_users_id_fk" FOREIGN KEY ("posted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_putaway_location_id_locations_id_fk" FOREIGN KEY ("putaway_location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "suppliers_code_idx" ON "suppliers" USING btree ("code");
  CREATE INDEX "suppliers_updated_at_idx" ON "suppliers" USING btree ("updated_at");
  CREATE INDEX "suppliers_created_at_idx" ON "suppliers" USING btree ("created_at");
  CREATE INDEX "purchase_orders_lines_order_idx" ON "purchase_orders_lines" USING btree ("_order");
  CREATE INDEX "purchase_orders_lines_parent_id_idx" ON "purchase_orders_lines" USING btree ("_parent_id");
  CREATE INDEX "purchase_orders_lines_sku_idx" ON "purchase_orders_lines" USING btree ("sku");
  CREATE UNIQUE INDEX "purchase_orders_number_idx" ON "purchase_orders" USING btree ("number");
  CREATE INDEX "purchase_orders_supplier_idx" ON "purchase_orders" USING btree ("supplier_id");
  CREATE INDEX "purchase_orders_warehouse_idx" ON "purchase_orders" USING btree ("warehouse_id");
  CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders" USING btree ("status");
  CREATE INDEX "purchase_orders_updated_at_idx" ON "purchase_orders" USING btree ("updated_at");
  CREATE INDEX "purchase_orders_created_at_idx" ON "purchase_orders" USING btree ("created_at");
  CREATE INDEX "goods_receipts_lines_exceptions_order_idx" ON "goods_receipts_lines_exceptions" USING btree ("_order");
  CREATE INDEX "goods_receipts_lines_exceptions_parent_id_idx" ON "goods_receipts_lines_exceptions" USING btree ("_parent_id");
  CREATE INDEX "goods_receipts_lines_order_idx" ON "goods_receipts_lines" USING btree ("_order");
  CREATE INDEX "goods_receipts_lines_parent_id_idx" ON "goods_receipts_lines" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "goods_receipts_number_idx" ON "goods_receipts" USING btree ("number");
  CREATE INDEX "goods_receipts_purchase_order_idx" ON "goods_receipts" USING btree ("purchase_order_id");
  CREATE INDEX "goods_receipts_location_idx" ON "goods_receipts" USING btree ("location_id");
  CREATE INDEX "goods_receipts_posted_by_idx" ON "goods_receipts" USING btree ("posted_by_id");
  CREATE INDEX "goods_receipts_putaway_location_idx" ON "goods_receipts" USING btree ("putaway_location_id");
  CREATE INDEX "goods_receipts_updated_at_idx" ON "goods_receipts" USING btree ("updated_at");
  CREATE INDEX "goods_receipts_created_at_idx" ON "goods_receipts" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_suppliers_fk" FOREIGN KEY ("suppliers_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_purchase_orders_fk" FOREIGN KEY ("purchase_orders_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_goods_receipts_fk" FOREIGN KEY ("goods_receipts_id") REFERENCES "public"."goods_receipts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_suppliers_id_idx" ON "payload_locked_documents_rels" USING btree ("suppliers_id");
  CREATE INDEX "payload_locked_documents_rels_purchase_orders_id_idx" ON "payload_locked_documents_rels" USING btree ("purchase_orders_id");
  CREATE INDEX "payload_locked_documents_rels_goods_receipts_id_idx" ON "payload_locked_documents_rels" USING btree ("goods_receipts_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "suppliers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "purchase_orders_lines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "purchase_orders" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "goods_receipts_lines_exceptions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "goods_receipts_lines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "goods_receipts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "suppliers" CASCADE;
  DROP TABLE "purchase_orders_lines" CASCADE;
  DROP TABLE "purchase_orders" CASCADE;
  DROP TABLE "goods_receipts_lines_exceptions" CASCADE;
  DROP TABLE "goods_receipts_lines" CASCADE;
  DROP TABLE "goods_receipts" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_suppliers_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_purchase_orders_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_goods_receipts_fk";
  
  DROP INDEX "payload_locked_documents_rels_suppliers_id_idx";
  DROP INDEX "payload_locked_documents_rels_purchase_orders_id_idx";
  DROP INDEX "payload_locked_documents_rels_goods_receipts_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "suppliers_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "purchase_orders_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "goods_receipts_id";
  DROP TYPE "public"."enum_purchase_orders_status";
  DROP TYPE "public"."enum_goods_receipts_lines_exceptions_type";
  DROP TYPE "public"."enum_goods_receipts_status";`)
}
