import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_warehouses_market" AS ENUM('ae', 'sa', 'qa', 'kw', 'bh', 'om');
  CREATE TYPE "public"."enum_warehouses_type" AS ENUM('warehouse', 'showroom', 'demo', 'consignment', 'service');
  CREATE TYPE "public"."enum_stock_movements_from_state" AS ENUM('received', 'available', 'reserved', 'picked', 'shipped', 'delivered', 'demo', 'ex_display', 'in_transit', 'bonded', 'damaged', 'rma', 'quarantine');
  CREATE TYPE "public"."enum_stock_movements_to_state" AS ENUM('received', 'available', 'reserved', 'picked', 'shipped', 'delivered', 'demo', 'ex_display', 'in_transit', 'bonded', 'damaged', 'rma', 'quarantine');
  CREATE TYPE "public"."enum_stock_movements_doc_type" AS ENUM('receipt', 'opening', 'transfer', 'cart', 'quote', 'pos', 'project', 'order', 'shipment', 'count', 'adjustment', 'rma');
  CREATE TYPE "public"."enum_stock_levels_state" AS ENUM('received', 'available', 'reserved', 'picked', 'shipped', 'delivered', 'demo', 'ex_display', 'in_transit', 'bonded', 'damaged', 'rma', 'quarantine');
  CREATE TYPE "public"."enum_serial_numbers_current_state" AS ENUM('received', 'available', 'reserved', 'picked', 'shipped', 'delivered', 'demo', 'ex_display', 'in_transit', 'bonded', 'damaged', 'rma', 'quarantine');
  CREATE TYPE "public"."enum_reservations_doc_type" AS ENUM('cart', 'quote', 'pos', 'project', 'order');
  CREATE TYPE "public"."enum_reservations_status" AS ENUM('active', 'released', 'expired', 'picked');
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'releaseExpiredReservations');
  CREATE TYPE "public"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'releaseExpiredReservations');
  CREATE TABLE "warehouses" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"market" "enum_warehouses_market" NOT NULL,
  	"type" "enum_warehouses_type" DEFAULT 'warehouse' NOT NULL,
  	"address_line1" varchar,
  	"address_city" varchar,
  	"active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "warehouses_locales" (
  	"name" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "locations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"warehouse_id" integer NOT NULL,
  	"name" varchar,
  	"sellable" boolean DEFAULT false,
  	"priority" numeric DEFAULT 100,
  	"active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "stock_movements" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"sku" varchar NOT NULL,
  	"serial" varchar,
  	"qty" numeric NOT NULL,
  	"from_state" "enum_stock_movements_from_state",
  	"to_state" "enum_stock_movements_to_state",
  	"location_id" integer NOT NULL,
  	"doc_type" "enum_stock_movements_doc_type" NOT NULL,
  	"doc_id" varchar NOT NULL,
  	"user_id" integer,
  	"reason" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "stock_levels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"sku" varchar NOT NULL,
  	"location_id" integer NOT NULL,
  	"state" "enum_stock_levels_state" NOT NULL,
  	"qty" numeric DEFAULT 0 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "serial_numbers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"serial" varchar NOT NULL,
  	"sku" varchar NOT NULL,
  	"current_state" "enum_serial_numbers_current_state",
  	"location_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "reservations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"sku" varchar NOT NULL,
  	"location_id" integer NOT NULL,
  	"qty" numeric NOT NULL,
  	"serials" jsonb,
  	"doc_type" "enum_reservations_doc_type" NOT NULL,
  	"doc_id" varchar NOT NULL,
  	"status" "enum_reservations_status" DEFAULT 'active' NOT NULL,
  	"expires_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_jobs_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"executed_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone NOT NULL,
  	"task_slug" "enum_payload_jobs_log_task_slug" NOT NULL,
  	"task_i_d" varchar NOT NULL,
  	"input" jsonb,
  	"output" jsonb,
  	"state" "enum_payload_jobs_log_state" NOT NULL,
  	"error" jsonb
  );
  
  CREATE TABLE "payload_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"input" jsonb,
  	"completed_at" timestamp(3) with time zone,
  	"total_tried" numeric DEFAULT 0,
  	"has_error" boolean DEFAULT false,
  	"error" jsonb,
  	"task_slug" "enum_payload_jobs_task_slug",
  	"queue" varchar DEFAULT 'default',
  	"wait_until" timestamp(3) with time zone,
  	"processing" boolean DEFAULT false,
  	"meta" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_jobs_stats" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"stats" jsonb,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "warehouses_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "locations_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "stock_movements_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "stock_levels_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "serial_numbers_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "reservations_id" integer;
  ALTER TABLE "warehouses_locales" ADD CONSTRAINT "warehouses_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "locations" ADD CONSTRAINT "locations_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "serial_numbers" ADD CONSTRAINT "serial_numbers_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reservations" ADD CONSTRAINT "reservations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "warehouses_code_idx" ON "warehouses" USING btree ("code");
  CREATE INDEX "warehouses_updated_at_idx" ON "warehouses" USING btree ("updated_at");
  CREATE INDEX "warehouses_created_at_idx" ON "warehouses" USING btree ("created_at");
  CREATE UNIQUE INDEX "warehouses_locales_locale_parent_id_unique" ON "warehouses_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "locations_warehouse_idx" ON "locations" USING btree ("warehouse_id");
  CREATE INDEX "locations_updated_at_idx" ON "locations" USING btree ("updated_at");
  CREATE INDEX "locations_created_at_idx" ON "locations" USING btree ("created_at");
  CREATE UNIQUE INDEX "warehouse_code_idx" ON "locations" USING btree ("warehouse_id","code");
  CREATE INDEX "stock_movements_sku_idx" ON "stock_movements" USING btree ("sku");
  CREATE INDEX "stock_movements_serial_idx" ON "stock_movements" USING btree ("serial");
  CREATE INDEX "stock_movements_location_idx" ON "stock_movements" USING btree ("location_id");
  CREATE INDEX "stock_movements_user_idx" ON "stock_movements" USING btree ("user_id");
  CREATE INDEX "stock_movements_updated_at_idx" ON "stock_movements" USING btree ("updated_at");
  CREATE INDEX "stock_movements_created_at_idx" ON "stock_movements" USING btree ("created_at");
  CREATE INDEX "sku_location_idx" ON "stock_movements" USING btree ("sku","location_id");
  CREATE INDEX "stock_levels_sku_idx" ON "stock_levels" USING btree ("sku");
  CREATE INDEX "stock_levels_location_idx" ON "stock_levels" USING btree ("location_id");
  CREATE INDEX "stock_levels_updated_at_idx" ON "stock_levels" USING btree ("updated_at");
  CREATE INDEX "stock_levels_created_at_idx" ON "stock_levels" USING btree ("created_at");
  CREATE UNIQUE INDEX "sku_location_state_idx" ON "stock_levels" USING btree ("sku","location_id","state");
  CREATE UNIQUE INDEX "serial_numbers_serial_idx" ON "serial_numbers" USING btree ("serial");
  CREATE INDEX "serial_numbers_sku_idx" ON "serial_numbers" USING btree ("sku");
  CREATE INDEX "serial_numbers_location_idx" ON "serial_numbers" USING btree ("location_id");
  CREATE INDEX "serial_numbers_updated_at_idx" ON "serial_numbers" USING btree ("updated_at");
  CREATE INDEX "serial_numbers_created_at_idx" ON "serial_numbers" USING btree ("created_at");
  CREATE INDEX "reservations_sku_idx" ON "reservations" USING btree ("sku");
  CREATE INDEX "reservations_location_idx" ON "reservations" USING btree ("location_id");
  CREATE INDEX "reservations_updated_at_idx" ON "reservations" USING btree ("updated_at");
  CREATE INDEX "reservations_created_at_idx" ON "reservations" USING btree ("created_at");
  CREATE INDEX "status_expiresAt_idx" ON "reservations" USING btree ("status","expires_at");
  CREATE INDEX "docType_docId_idx" ON "reservations" USING btree ("doc_type","doc_id");
  CREATE INDEX "payload_jobs_log_order_idx" ON "payload_jobs_log" USING btree ("_order");
  CREATE INDEX "payload_jobs_log_parent_id_idx" ON "payload_jobs_log" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_completed_at_idx" ON "payload_jobs" USING btree ("completed_at");
  CREATE INDEX "payload_jobs_total_tried_idx" ON "payload_jobs" USING btree ("total_tried");
  CREATE INDEX "payload_jobs_has_error_idx" ON "payload_jobs" USING btree ("has_error");
  CREATE INDEX "payload_jobs_task_slug_idx" ON "payload_jobs" USING btree ("task_slug");
  CREATE INDEX "payload_jobs_queue_idx" ON "payload_jobs" USING btree ("queue");
  CREATE INDEX "payload_jobs_wait_until_idx" ON "payload_jobs" USING btree ("wait_until");
  CREATE INDEX "payload_jobs_processing_idx" ON "payload_jobs" USING btree ("processing");
  CREATE INDEX "payload_jobs_updated_at_idx" ON "payload_jobs" USING btree ("updated_at");
  CREATE INDEX "payload_jobs_created_at_idx" ON "payload_jobs" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_warehouses_fk" FOREIGN KEY ("warehouses_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_locations_fk" FOREIGN KEY ("locations_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_stock_movements_fk" FOREIGN KEY ("stock_movements_id") REFERENCES "public"."stock_movements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_stock_levels_fk" FOREIGN KEY ("stock_levels_id") REFERENCES "public"."stock_levels"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_serial_numbers_fk" FOREIGN KEY ("serial_numbers_id") REFERENCES "public"."serial_numbers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reservations_fk" FOREIGN KEY ("reservations_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_warehouses_id_idx" ON "payload_locked_documents_rels" USING btree ("warehouses_id");
  CREATE INDEX "payload_locked_documents_rels_locations_id_idx" ON "payload_locked_documents_rels" USING btree ("locations_id");
  CREATE INDEX "payload_locked_documents_rels_stock_movements_id_idx" ON "payload_locked_documents_rels" USING btree ("stock_movements_id");
  CREATE INDEX "payload_locked_documents_rels_stock_levels_id_idx" ON "payload_locked_documents_rels" USING btree ("stock_levels_id");
  CREATE INDEX "payload_locked_documents_rels_serial_numbers_id_idx" ON "payload_locked_documents_rels" USING btree ("serial_numbers_id");
  CREATE INDEX "payload_locked_documents_rels_reservations_id_idx" ON "payload_locked_documents_rels" USING btree ("reservations_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "warehouses" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "warehouses_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "locations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "stock_movements" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "stock_levels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "serial_numbers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "reservations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_jobs_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_jobs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_jobs_stats" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "warehouses" CASCADE;
  DROP TABLE "warehouses_locales" CASCADE;
  DROP TABLE "locations" CASCADE;
  DROP TABLE "stock_movements" CASCADE;
  DROP TABLE "stock_levels" CASCADE;
  DROP TABLE "serial_numbers" CASCADE;
  DROP TABLE "reservations" CASCADE;
  DROP TABLE "payload_jobs_log" CASCADE;
  DROP TABLE "payload_jobs" CASCADE;
  DROP TABLE "payload_jobs_stats" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_warehouses_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_locations_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_stock_movements_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_stock_levels_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_serial_numbers_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_reservations_fk";
  
  DROP INDEX "payload_locked_documents_rels_warehouses_id_idx";
  DROP INDEX "payload_locked_documents_rels_locations_id_idx";
  DROP INDEX "payload_locked_documents_rels_stock_movements_id_idx";
  DROP INDEX "payload_locked_documents_rels_stock_levels_id_idx";
  DROP INDEX "payload_locked_documents_rels_serial_numbers_id_idx";
  DROP INDEX "payload_locked_documents_rels_reservations_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "warehouses_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "locations_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "stock_movements_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "stock_levels_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "serial_numbers_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "reservations_id";
  DROP TYPE "public"."enum_warehouses_market";
  DROP TYPE "public"."enum_warehouses_type";
  DROP TYPE "public"."enum_stock_movements_from_state";
  DROP TYPE "public"."enum_stock_movements_to_state";
  DROP TYPE "public"."enum_stock_movements_doc_type";
  DROP TYPE "public"."enum_stock_levels_state";
  DROP TYPE "public"."enum_serial_numbers_current_state";
  DROP TYPE "public"."enum_reservations_doc_type";
  DROP TYPE "public"."enum_reservations_status";
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  DROP TYPE "public"."enum_payload_jobs_log_state";
  DROP TYPE "public"."enum_payload_jobs_task_slug";`)
}
