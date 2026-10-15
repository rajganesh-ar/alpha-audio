import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_customers_market" AS ENUM('ae', 'sa', 'qa', 'kw', 'bh', 'om');
  CREATE TYPE "public"."enum_customers_locale" AS ENUM('en', 'ar');
  CREATE TYPE "public"."enum_sign_in_links_market" AS ENUM('ae', 'sa', 'qa', 'kw', 'bh', 'om');
  CREATE TYPE "public"."enum_sign_in_links_locale" AS ENUM('en', 'ar');
  ALTER TYPE "public"."enum_notifications_template" ADD VALUE 'sign-in';
  CREATE TABLE "customers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"name" varchar,
  	"phone" varchar,
  	"market" "enum_customers_market" NOT NULL,
  	"locale" "enum_customers_locale" NOT NULL,
  	"last_sign_in_at" timestamp(3) with time zone,
  	"marketing_consent" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "customer_sessions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"token_hash" varchar NOT NULL,
  	"customer_id" integer NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"revoked_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "sign_in_links" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"token_hash" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"market" "enum_sign_in_links_market" NOT NULL,
  	"locale" "enum_sign_in_links_locale" NOT NULL,
  	"ip_hash" varchar,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"used_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "notifications" ALTER COLUMN "order_id" DROP NOT NULL;
  ALTER TABLE "notifications" ADD COLUMN "customer_id" integer;
  ALTER TABLE "notifications" ADD COLUMN "secret" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "customers_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "customer_sessions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "sign_in_links_id" integer;
  ALTER TABLE "payload_preferences_rels" ADD COLUMN "customers_id" integer;
  ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "customers_email_idx" ON "customers" USING btree ("email");
  CREATE INDEX "customers_updated_at_idx" ON "customers" USING btree ("updated_at");
  CREATE INDEX "customers_created_at_idx" ON "customers" USING btree ("created_at");
  CREATE UNIQUE INDEX "customer_sessions_token_hash_idx" ON "customer_sessions" USING btree ("token_hash");
  CREATE INDEX "customer_sessions_customer_idx" ON "customer_sessions" USING btree ("customer_id");
  CREATE INDEX "customer_sessions_expires_at_idx" ON "customer_sessions" USING btree ("expires_at");
  CREATE INDEX "customer_sessions_updated_at_idx" ON "customer_sessions" USING btree ("updated_at");
  CREATE INDEX "customer_sessions_created_at_idx" ON "customer_sessions" USING btree ("created_at");
  CREATE UNIQUE INDEX "sign_in_links_token_hash_idx" ON "sign_in_links" USING btree ("token_hash");
  CREATE INDEX "sign_in_links_email_idx" ON "sign_in_links" USING btree ("email");
  CREATE INDEX "sign_in_links_ip_hash_idx" ON "sign_in_links" USING btree ("ip_hash");
  CREATE INDEX "sign_in_links_updated_at_idx" ON "sign_in_links" USING btree ("updated_at");
  CREATE INDEX "sign_in_links_created_at_idx" ON "sign_in_links" USING btree ("created_at");
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_customer_sessions_fk" FOREIGN KEY ("customer_sessions_id") REFERENCES "public"."customer_sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sign_in_links_fk" FOREIGN KEY ("sign_in_links_id") REFERENCES "public"."sign_in_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "notifications_customer_idx" ON "notifications" USING btree ("customer_id");
  CREATE INDEX "payload_locked_documents_rels_customers_id_idx" ON "payload_locked_documents_rels" USING btree ("customers_id");
  CREATE INDEX "payload_locked_documents_rels_customer_sessions_id_idx" ON "payload_locked_documents_rels" USING btree ("customer_sessions_id");
  CREATE INDEX "payload_locked_documents_rels_sign_in_links_id_idx" ON "payload_locked_documents_rels" USING btree ("sign_in_links_id");
  CREATE INDEX "payload_preferences_rels_customers_id_idx" ON "payload_preferences_rels" USING btree ("customers_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "customers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "customer_sessions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "sign_in_links" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "customers" CASCADE;
  DROP TABLE "customer_sessions" CASCADE;
  DROP TABLE "sign_in_links" CASCADE;
  ALTER TABLE "notifications" DROP CONSTRAINT "notifications_customer_id_customers_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_customers_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_customer_sessions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_sign_in_links_fk";
  
  ALTER TABLE "payload_preferences_rels" DROP CONSTRAINT "payload_preferences_rels_customers_fk";
  
  ALTER TABLE "notifications" ALTER COLUMN "template" SET DATA TYPE text;
  DROP TYPE "public"."enum_notifications_template";
  CREATE TYPE "public"."enum_notifications_template" AS ENUM('order-confirmed', 'order-shipped', 'order-delivered', 'order-cancelled');
  ALTER TABLE "notifications" ALTER COLUMN "template" SET DATA TYPE "public"."enum_notifications_template" USING "template"::"public"."enum_notifications_template";
  DROP INDEX "notifications_customer_idx";
  DROP INDEX "payload_locked_documents_rels_customers_id_idx";
  DROP INDEX "payload_locked_documents_rels_customer_sessions_id_idx";
  DROP INDEX "payload_locked_documents_rels_sign_in_links_id_idx";
  DROP INDEX "payload_preferences_rels_customers_id_idx";
  ALTER TABLE "notifications" ALTER COLUMN "order_id" SET NOT NULL;
  ALTER TABLE "notifications" DROP COLUMN "customer_id";
  ALTER TABLE "notifications" DROP COLUMN "secret";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "customers_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "customer_sessions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "sign_in_links_id";
  ALTER TABLE "payload_preferences_rels" DROP COLUMN "customers_id";
  DROP TYPE "public"."enum_customers_market";
  DROP TYPE "public"."enum_customers_locale";
  DROP TYPE "public"."enum_sign_in_links_market";
  DROP TYPE "public"."enum_sign_in_links_locale";`)
}
