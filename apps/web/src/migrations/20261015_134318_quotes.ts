import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_quotes_status" AS ENUM('open', 'ordering', 'ordered', 'withdrawn', 'expired');
  CREATE TYPE "public"."enum_quotes_market" AS ENUM('ae', 'sa', 'qa', 'kw', 'bh', 'om');
  CREATE TABLE "quotes_lines" (
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
  	"held" boolean,
  	"trace" jsonb
  );
  
  CREATE TABLE "quotes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" varchar NOT NULL,
  	"status" "enum_quotes_status" NOT NULL,
  	"company_id" integer NOT NULL,
  	"created_by_id" integer NOT NULL,
  	"market" "enum_quotes_market" NOT NULL,
  	"currency" varchar NOT NULL,
  	"decimals" numeric NOT NULL,
  	"vat_rate" numeric NOT NULL,
  	"reference" varchar,
  	"note" varchar,
  	"totals_net" numeric,
  	"totals_vat" numeric,
  	"totals_gross" numeric,
  	"valid_until" timestamp(3) with time zone NOT NULL,
  	"order_number" varchar,
  	"fx_locked_at" timestamp(3) with time zone,
  	"fx_rates" jsonb,
  	"reservations" jsonb,
  	"idempotency_key" varchar NOT NULL,
  	"staff_notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "quotes_id" integer;
  ALTER TABLE "pricing_settings" ADD COLUMN "quote_validity_days" numeric DEFAULT 7 NOT NULL;
  ALTER TABLE "quotes_lines" ADD CONSTRAINT "quotes_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quotes_lines" ADD CONSTRAINT "quotes_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quotes" ADD CONSTRAINT "quotes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_id_company_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."company_users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "quotes_lines_order_idx" ON "quotes_lines" USING btree ("_order");
  CREATE INDEX "quotes_lines_parent_id_idx" ON "quotes_lines" USING btree ("_parent_id");
  CREATE INDEX "quotes_lines_product_idx" ON "quotes_lines" USING btree ("product_id");
  CREATE UNIQUE INDEX "quotes_number_idx" ON "quotes" USING btree ("number");
  CREATE INDEX "quotes_status_idx" ON "quotes" USING btree ("status");
  CREATE INDEX "quotes_company_idx" ON "quotes" USING btree ("company_id");
  CREATE INDEX "quotes_created_by_idx" ON "quotes" USING btree ("created_by_id");
  CREATE INDEX "quotes_valid_until_idx" ON "quotes" USING btree ("valid_until");
  CREATE UNIQUE INDEX "quotes_idempotency_key_idx" ON "quotes" USING btree ("idempotency_key");
  CREATE INDEX "quotes_updated_at_idx" ON "quotes" USING btree ("updated_at");
  CREATE INDEX "quotes_created_at_idx" ON "quotes" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_quotes_fk" FOREIGN KEY ("quotes_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_quotes_id_idx" ON "payload_locked_documents_rels" USING btree ("quotes_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "quotes_lines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "quotes" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "quotes_lines" CASCADE;
  DROP TABLE "quotes" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_quotes_fk";
  
  DROP INDEX "payload_locked_documents_rels_quotes_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "quotes_id";
  ALTER TABLE "pricing_settings" DROP COLUMN "quote_validity_days";
  DROP TYPE "public"."enum_quotes_status";
  DROP TYPE "public"."enum_quotes_market";`)
}
