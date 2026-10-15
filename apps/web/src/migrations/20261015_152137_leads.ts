import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_leads_status" AS ENUM('new', 'routing', 'offered', 'accepted', 'with-alpha', 'closed');
  CREATE TYPE "public"."enum_leads_source" AS ENUM('request-price', 'specialist');
  CREATE TYPE "public"."enum_leads_routing" AS ENUM('alpha', 'dealer');
  CREATE TYPE "public"."enum_leads_market" AS ENUM('ae', 'sa', 'qa', 'kw', 'bh', 'om');
  CREATE TYPE "public"."enum_leads_locale" AS ENUM('en', 'ar');
  CREATE TYPE "public"."enum_leads_outcome" AS ENUM('won', 'lost');
  ALTER TYPE "public"."enum_notifications_template" ADD VALUE 'lead-received';
  ALTER TYPE "public"."enum_notifications_template" ADD VALUE 'lead-offered';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'routeLead';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'rerouteExpiredLeads';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'routeLead';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'rerouteExpiredLeads';
  CREATE TABLE "companies_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "leads" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" varchar NOT NULL,
  	"status" "enum_leads_status" NOT NULL,
  	"source" "enum_leads_source" NOT NULL,
  	"routing" "enum_leads_routing" NOT NULL,
  	"market" "enum_leads_market" NOT NULL,
  	"locale" "enum_leads_locale" NOT NULL,
  	"brand_id" integer,
  	"product_id" integer,
  	"city" varchar,
  	"message" varchar,
  	"contact_name" varchar,
  	"contact_email" varchar,
  	"contact_phone" varchar,
  	"consent" boolean DEFAULT false,
  	"offered_to_id" integer,
  	"accept_by" timestamp(3) with time zone,
  	"outcome" "enum_leads_outcome",
  	"value" numeric,
  	"attempts" jsonb,
  	"idempotency_key" varchar NOT NULL,
  	"request_ip_hash" varchar,
  	"staff_notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "notifications" ADD COLUMN "lead_id" integer;
  ALTER TABLE "companies" ADD COLUMN "settings_accepts_leads" boolean DEFAULT false;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "leads_id" integer;
  ALTER TABLE "companies_texts" ADD CONSTRAINT "companies_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "leads" ADD CONSTRAINT "leads_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "leads" ADD CONSTRAINT "leads_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "leads" ADD CONSTRAINT "leads_offered_to_id_companies_id_fk" FOREIGN KEY ("offered_to_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "companies_texts_order_parent" ON "companies_texts" USING btree ("order","parent_id");
  CREATE UNIQUE INDEX "leads_number_idx" ON "leads" USING btree ("number");
  CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status");
  CREATE INDEX "leads_brand_idx" ON "leads" USING btree ("brand_id");
  CREATE INDEX "leads_product_idx" ON "leads" USING btree ("product_id");
  CREATE INDEX "leads_contact_contact_email_idx" ON "leads" USING btree ("contact_email");
  CREATE INDEX "leads_offered_to_idx" ON "leads" USING btree ("offered_to_id");
  CREATE INDEX "leads_accept_by_idx" ON "leads" USING btree ("accept_by");
  CREATE UNIQUE INDEX "leads_idempotency_key_idx" ON "leads" USING btree ("idempotency_key");
  CREATE INDEX "leads_request_ip_hash_idx" ON "leads" USING btree ("request_ip_hash");
  CREATE INDEX "leads_updated_at_idx" ON "leads" USING btree ("updated_at");
  CREATE INDEX "leads_created_at_idx" ON "leads" USING btree ("created_at");
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_leads_fk" FOREIGN KEY ("leads_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "notifications_lead_idx" ON "notifications" USING btree ("lead_id");
  CREATE INDEX "payload_locked_documents_rels_leads_id_idx" ON "payload_locked_documents_rels" USING btree ("leads_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "companies_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "leads" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "companies_texts" CASCADE;
  DROP TABLE "leads" CASCADE;
  ALTER TABLE "notifications" DROP CONSTRAINT "notifications_lead_id_leads_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_leads_fk";
  
  ALTER TABLE "notifications" ALTER COLUMN "template" SET DATA TYPE text;
  DROP TYPE "public"."enum_notifications_template";
  CREATE TYPE "public"."enum_notifications_template" AS ENUM('order-confirmed', 'order-shipped', 'order-delivered', 'order-cancelled', 'sign-in');
  ALTER TABLE "notifications" ALTER COLUMN "template" SET DATA TYPE "public"."enum_notifications_template" USING "template"::"public"."enum_notifications_template";
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'releaseExpiredReservations', 'expireCheckouts', 'sendNotification');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'releaseExpiredReservations', 'expireCheckouts', 'sendNotification');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "notifications_lead_idx";
  DROP INDEX "payload_locked_documents_rels_leads_id_idx";
  ALTER TABLE "notifications" DROP COLUMN "lead_id";
  ALTER TABLE "companies" DROP COLUMN "settings_accepts_leads";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "leads_id";
  DROP TYPE "public"."enum_leads_status";
  DROP TYPE "public"."enum_leads_source";
  DROP TYPE "public"."enum_leads_routing";
  DROP TYPE "public"."enum_leads_market";
  DROP TYPE "public"."enum_leads_locale";
  DROP TYPE "public"."enum_leads_outcome";`)
}
