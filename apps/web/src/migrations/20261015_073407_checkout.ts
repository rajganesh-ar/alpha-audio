import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_orders_status" AS ENUM('reserving', 'unavailable', 'paying', 'confirming', 'confirmed', 'failed', 'expired');
  CREATE TYPE "public"."enum_orders_failure_reason" AS ENUM('declined', 'payment-error', 'amount-mismatch', 'stock-lost');
  CREATE TYPE "public"."enum_orders_channel" AS ENUM('web');
  CREATE TYPE "public"."enum_orders_market" AS ENUM('ae', 'sa', 'qa', 'kw', 'bh', 'om');
  CREATE TYPE "public"."enum_orders_locale" AS ENUM('en', 'ar');
  CREATE TYPE "public"."enum_orders_payment_status" AS ENUM('pending', 'authorised', 'captured', 'declined', 'failed');
  CREATE TYPE "public"."enum_carts_market" AS ENUM('ae', 'sa', 'qa', 'kw', 'bh', 'om');
  CREATE TYPE "public"."enum_carts_locale" AS ENUM('en', 'ar');
  CREATE TYPE "public"."enum_carts_status" AS ENUM('open', 'converted');
  CREATE TABLE "orders_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer,
  	"sku" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"qty" numeric NOT NULL,
  	"unit_price" numeric NOT NULL,
  	"line_total" numeric NOT NULL,
  	"vat" numeric NOT NULL
  );
  
  CREATE TABLE "orders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" varchar NOT NULL,
  	"status" "enum_orders_status" NOT NULL,
  	"failure_reason" "enum_orders_failure_reason",
  	"channel" "enum_orders_channel" DEFAULT 'web' NOT NULL,
  	"market" "enum_orders_market" NOT NULL,
  	"locale" "enum_orders_locale" NOT NULL,
  	"currency" varchar NOT NULL,
  	"decimals" numeric NOT NULL,
  	"contact_name" varchar,
  	"contact_email" varchar,
  	"contact_phone" varchar,
  	"address" jsonb,
  	"payment_method" varchar,
  	"totals_subtotal" numeric NOT NULL,
  	"totals_vat" numeric NOT NULL,
  	"totals_delivery" numeric NOT NULL,
  	"totals_total" numeric NOT NULL,
  	"payment_provider" varchar,
  	"payment_intent_id" varchar,
  	"payment_status" "enum_orders_payment_status",
  	"reservations" jsonb,
  	"unavailable_skus" jsonb,
  	"hold_expires_at" timestamp(3) with time zone,
  	"idempotency_key" varchar NOT NULL,
  	"access_token_hash" varchar NOT NULL,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "carts_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"sku" varchar NOT NULL,
  	"qty" numeric NOT NULL,
  	"price_snapshot" numeric
  );
  
  CREATE TABLE "carts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"token_hash" varchar NOT NULL,
  	"market" "enum_carts_market" NOT NULL,
  	"locale" "enum_carts_locale" NOT NULL,
  	"draft" jsonb,
  	"status" "enum_carts_status" DEFAULT 'open' NOT NULL,
  	"order_id" integer,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "webhook_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"provider" varchar NOT NULL,
  	"event_id" varchar NOT NULL,
  	"payload_hash" varchar NOT NULL,
  	"outcome" varchar,
  	"received_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "orders_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "carts_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "webhook_events_id" integer;
  ALTER TABLE "orders_lines" ADD CONSTRAINT "orders_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders_lines" ADD CONSTRAINT "orders_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "carts_lines" ADD CONSTRAINT "carts_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "carts" ADD CONSTRAINT "carts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "orders_lines_order_idx" ON "orders_lines" USING btree ("_order");
  CREATE INDEX "orders_lines_parent_id_idx" ON "orders_lines" USING btree ("_parent_id");
  CREATE INDEX "orders_lines_product_idx" ON "orders_lines" USING btree ("product_id");
  CREATE UNIQUE INDEX "orders_number_idx" ON "orders" USING btree ("number");
  CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");
  CREATE INDEX "orders_payment_payment_intent_id_idx" ON "orders" USING btree ("payment_intent_id");
  CREATE UNIQUE INDEX "orders_idempotency_key_idx" ON "orders" USING btree ("idempotency_key");
  CREATE INDEX "orders_updated_at_idx" ON "orders" USING btree ("updated_at");
  CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");
  CREATE INDEX "carts_lines_order_idx" ON "carts_lines" USING btree ("_order");
  CREATE INDEX "carts_lines_parent_id_idx" ON "carts_lines" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "carts_token_hash_idx" ON "carts" USING btree ("token_hash");
  CREATE INDEX "carts_order_idx" ON "carts" USING btree ("order_id");
  CREATE INDEX "carts_expires_at_idx" ON "carts" USING btree ("expires_at");
  CREATE INDEX "carts_updated_at_idx" ON "carts" USING btree ("updated_at");
  CREATE INDEX "carts_created_at_idx" ON "carts" USING btree ("created_at");
  CREATE INDEX "webhook_events_provider_idx" ON "webhook_events" USING btree ("provider");
  CREATE INDEX "webhook_events_updated_at_idx" ON "webhook_events" USING btree ("updated_at");
  CREATE INDEX "webhook_events_created_at_idx" ON "webhook_events" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_orders_fk" FOREIGN KEY ("orders_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_carts_fk" FOREIGN KEY ("carts_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_webhook_events_fk" FOREIGN KEY ("webhook_events_id") REFERENCES "public"."webhook_events"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_orders_id_idx" ON "payload_locked_documents_rels" USING btree ("orders_id");
  CREATE INDEX "payload_locked_documents_rels_carts_id_idx" ON "payload_locked_documents_rels" USING btree ("carts_id");
  CREATE INDEX "payload_locked_documents_rels_webhook_events_id_idx" ON "payload_locked_documents_rels" USING btree ("webhook_events_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders_lines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "orders" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "carts_lines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "carts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "webhook_events" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "orders_lines" CASCADE;
  DROP TABLE "orders" CASCADE;
  DROP TABLE "carts_lines" CASCADE;
  DROP TABLE "carts" CASCADE;
  DROP TABLE "webhook_events" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_orders_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_carts_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_webhook_events_fk";
  
  DROP INDEX "payload_locked_documents_rels_orders_id_idx";
  DROP INDEX "payload_locked_documents_rels_carts_id_idx";
  DROP INDEX "payload_locked_documents_rels_webhook_events_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "orders_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "carts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "webhook_events_id";
  DROP TYPE "public"."enum_orders_status";
  DROP TYPE "public"."enum_orders_failure_reason";
  DROP TYPE "public"."enum_orders_channel";
  DROP TYPE "public"."enum_orders_market";
  DROP TYPE "public"."enum_orders_locale";
  DROP TYPE "public"."enum_orders_payment_status";
  DROP TYPE "public"."enum_carts_market";
  DROP TYPE "public"."enum_carts_locale";
  DROP TYPE "public"."enum_carts_status";`)
}
