import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_project_registrations_status" AS ENUM('submitted', 'reviewing', 'approved', 'rejected', 'withdrawn', 'expired');
  CREATE TYPE "public"."enum_project_registrations_market" AS ENUM('ae', 'sa', 'qa', 'kw', 'bh', 'om');
  CREATE TABLE "project_registrations_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer,
  	"sku" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"qty" numeric NOT NULL,
  	"project_price" numeric
  );
  
  CREATE TABLE "project_registrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" varchar NOT NULL,
  	"status" "enum_project_registrations_status" NOT NULL,
  	"company_id" integer NOT NULL,
  	"registered_by_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"end_customer" varchar NOT NULL,
  	"city" varchar,
  	"market" "enum_project_registrations_market" NOT NULL,
  	"expected_close" timestamp(3) with time zone NOT NULL,
  	"valid_until" timestamp(3) with time zone,
  	"decided_at" timestamp(3) with time zone,
  	"note" varchar,
  	"decided_by_id" integer,
  	"decision_note" varchar,
  	"idempotency_key" varchar NOT NULL,
  	"staff_notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "trade_orders" ADD COLUMN "project" varchar;
  ALTER TABLE "quotes" ADD COLUMN "project" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "project_registrations_id" integer;
  ALTER TABLE "project_registrations_lines" ADD CONSTRAINT "project_registrations_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "project_registrations_lines" ADD CONSTRAINT "project_registrations_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."project_registrations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "project_registrations" ADD CONSTRAINT "project_registrations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "project_registrations" ADD CONSTRAINT "project_registrations_registered_by_id_company_users_id_fk" FOREIGN KEY ("registered_by_id") REFERENCES "public"."company_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "project_registrations" ADD CONSTRAINT "project_registrations_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "project_registrations_lines_order_idx" ON "project_registrations_lines" USING btree ("_order");
  CREATE INDEX "project_registrations_lines_parent_id_idx" ON "project_registrations_lines" USING btree ("_parent_id");
  CREATE INDEX "project_registrations_lines_product_idx" ON "project_registrations_lines" USING btree ("product_id");
  CREATE UNIQUE INDEX "project_registrations_number_idx" ON "project_registrations" USING btree ("number");
  CREATE INDEX "project_registrations_status_idx" ON "project_registrations" USING btree ("status");
  CREATE INDEX "project_registrations_company_idx" ON "project_registrations" USING btree ("company_id");
  CREATE INDEX "project_registrations_registered_by_idx" ON "project_registrations" USING btree ("registered_by_id");
  CREATE INDEX "project_registrations_valid_until_idx" ON "project_registrations" USING btree ("valid_until");
  CREATE INDEX "project_registrations_decided_by_idx" ON "project_registrations" USING btree ("decided_by_id");
  CREATE UNIQUE INDEX "project_registrations_idempotency_key_idx" ON "project_registrations" USING btree ("idempotency_key");
  CREATE INDEX "project_registrations_updated_at_idx" ON "project_registrations" USING btree ("updated_at");
  CREATE INDEX "project_registrations_created_at_idx" ON "project_registrations" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_project_registrations_fk" FOREIGN KEY ("project_registrations_id") REFERENCES "public"."project_registrations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "trade_orders_project_idx" ON "trade_orders" USING btree ("project");
  CREATE INDEX "quotes_project_idx" ON "quotes" USING btree ("project");
  CREATE INDEX "payload_locked_documents_rels_project_registrations_id_idx" ON "payload_locked_documents_rels" USING btree ("project_registrations_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "project_registrations_lines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "project_registrations" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "project_registrations_lines" CASCADE;
  DROP TABLE "project_registrations" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_project_registrations_fk";
  
  DROP INDEX "trade_orders_project_idx";
  DROP INDEX "quotes_project_idx";
  DROP INDEX "payload_locked_documents_rels_project_registrations_id_idx";
  ALTER TABLE "trade_orders" DROP COLUMN "project";
  ALTER TABLE "quotes" DROP COLUMN "project";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "project_registrations_id";
  DROP TYPE "public"."enum_project_registrations_status";
  DROP TYPE "public"."enum_project_registrations_market";`)
}
