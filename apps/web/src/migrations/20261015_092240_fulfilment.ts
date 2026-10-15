import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_orders_fulfilment" AS ENUM('awaiting', 'picking', 'picked', 'shipping', 'shipped', 'delivering', 'delivered', 'cancelling', 'cancelled');
  CREATE TYPE "public"."enum_orders_refund_status" AS ENUM('none', 'pending', 'refunded', 'manual', 'failed');
  CREATE TYPE "public"."enum_shipments_market" AS ENUM('ae', 'sa', 'qa', 'kw', 'bh', 'om');
  CREATE TYPE "public"."enum_shipments_status" AS ENUM('shipped', 'delivered');
  CREATE TYPE "public"."enum_notifications_template" AS ENUM('order-confirmed', 'order-shipped', 'order-delivered', 'order-cancelled');
  CREATE TYPE "public"."enum_notifications_channel" AS ENUM('email');
  CREATE TYPE "public"."enum_notifications_locale" AS ENUM('en', 'ar');
  CREATE TYPE "public"."enum_notifications_status" AS ENUM('queued', 'sent', 'failed');
  ALTER TYPE "public"."enum_reservations_status" ADD VALUE 'shipped';
  ALTER TYPE "public"."enum_reservations_status" ADD VALUE 'delivered';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'sendNotification';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'sendNotification';
  CREATE TABLE "shipments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" varchar NOT NULL,
  	"order_id" integer NOT NULL,
  	"market" "enum_shipments_market" NOT NULL,
  	"status" "enum_shipments_status" DEFAULT 'shipped' NOT NULL,
  	"courier" varchar NOT NULL,
  	"tracking_number" varchar NOT NULL,
  	"tracking_url" varchar,
  	"shipped_at" timestamp(3) with time zone NOT NULL,
  	"delivered_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "notifications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"order_id" integer NOT NULL,
  	"template" "enum_notifications_template" NOT NULL,
  	"channel" "enum_notifications_channel" DEFAULT 'email' NOT NULL,
  	"locale" "enum_notifications_locale" NOT NULL,
  	"to" varchar NOT NULL,
  	"status" "enum_notifications_status" DEFAULT 'queued' NOT NULL,
  	"attempts" numeric DEFAULT 0 NOT NULL,
  	"sent_at" timestamp(3) with time zone,
  	"last_error" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "orders" ADD COLUMN "fulfilment" "enum_orders_fulfilment" DEFAULT 'awaiting' NOT NULL;
  ALTER TABLE "orders" ADD COLUMN "shipment_id" integer;
  ALTER TABLE "orders" ADD COLUMN "cancel_reason" varchar;
  ALTER TABLE "orders" ADD COLUMN "refund_status" "enum_orders_refund_status" DEFAULT 'none' NOT NULL;
  ALTER TABLE "orders" ADD COLUMN "refund_amount" numeric;
  ALTER TABLE "orders" ADD COLUMN "refund_reference" varchar;
  ALTER TABLE "orders" ADD COLUMN "refund_error" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "shipments_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "notifications_id" integer;
  ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "shipments_number_idx" ON "shipments" USING btree ("number");
  CREATE UNIQUE INDEX "shipments_order_idx" ON "shipments" USING btree ("order_id");
  CREATE INDEX "shipments_tracking_number_idx" ON "shipments" USING btree ("tracking_number");
  CREATE INDEX "shipments_updated_at_idx" ON "shipments" USING btree ("updated_at");
  CREATE INDEX "shipments_created_at_idx" ON "shipments" USING btree ("created_at");
  CREATE UNIQUE INDEX "notifications_key_idx" ON "notifications" USING btree ("key");
  CREATE INDEX "notifications_order_idx" ON "notifications" USING btree ("order_id");
  CREATE INDEX "notifications_status_idx" ON "notifications" USING btree ("status");
  CREATE INDEX "notifications_updated_at_idx" ON "notifications" USING btree ("updated_at");
  CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");
  ALTER TABLE "orders" ADD CONSTRAINT "orders_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_shipments_fk" FOREIGN KEY ("shipments_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notifications_fk" FOREIGN KEY ("notifications_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "orders_fulfilment_idx" ON "orders" USING btree ("fulfilment");
  CREATE INDEX "orders_shipment_idx" ON "orders" USING btree ("shipment_id");
  CREATE INDEX "payload_locked_documents_rels_shipments_id_idx" ON "payload_locked_documents_rels" USING btree ("shipments_id");
  CREATE INDEX "payload_locked_documents_rels_notifications_id_idx" ON "payload_locked_documents_rels" USING btree ("notifications_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "shipments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "notifications" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "shipments" CASCADE;
  DROP TABLE "notifications" CASCADE;
  ALTER TABLE "orders" DROP CONSTRAINT "orders_shipment_id_shipments_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_shipments_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_notifications_fk";
  
  ALTER TABLE "reservations" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "reservations" ALTER COLUMN "status" SET DEFAULT 'active'::text;
  DROP TYPE "public"."enum_reservations_status";
  CREATE TYPE "public"."enum_reservations_status" AS ENUM('active', 'released', 'expired', 'picked');
  ALTER TABLE "reservations" ALTER COLUMN "status" SET DEFAULT 'active'::"public"."enum_reservations_status";
  ALTER TABLE "reservations" ALTER COLUMN "status" SET DATA TYPE "public"."enum_reservations_status" USING "status"::"public"."enum_reservations_status";
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'releaseExpiredReservations', 'expireCheckouts');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'releaseExpiredReservations', 'expireCheckouts');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "orders_fulfilment_idx";
  DROP INDEX "orders_shipment_idx";
  DROP INDEX "payload_locked_documents_rels_shipments_id_idx";
  DROP INDEX "payload_locked_documents_rels_notifications_id_idx";
  ALTER TABLE "orders" DROP COLUMN "fulfilment";
  ALTER TABLE "orders" DROP COLUMN "shipment_id";
  ALTER TABLE "orders" DROP COLUMN "cancel_reason";
  ALTER TABLE "orders" DROP COLUMN "refund_status";
  ALTER TABLE "orders" DROP COLUMN "refund_amount";
  ALTER TABLE "orders" DROP COLUMN "refund_reference";
  ALTER TABLE "orders" DROP COLUMN "refund_error";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "shipments_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "notifications_id";
  DROP TYPE "public"."enum_orders_fulfilment";
  DROP TYPE "public"."enum_orders_refund_status";
  DROP TYPE "public"."enum_shipments_market";
  DROP TYPE "public"."enum_shipments_status";
  DROP TYPE "public"."enum_notifications_template";
  DROP TYPE "public"."enum_notifications_channel";
  DROP TYPE "public"."enum_notifications_locale";
  DROP TYPE "public"."enum_notifications_status";`)
}
