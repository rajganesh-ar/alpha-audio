import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_legacy_redirects_status" AS ENUM('301', '302');
  CREATE TYPE "public"."enum_markets_markets_enabled_locales" AS ENUM('en', 'ar');
  CREATE TYPE "public"."enum_markets_markets_payments" AS ENUM('card', 'applepay', 'googlepay', 'tabby', 'tamara', 'cod', 'mada', 'naps', 'knet', 'benefitpay', 'omannet');
  CREATE TYPE "public"."enum_markets_markets_code" AS ENUM('ae', 'sa', 'qa', 'kw', 'bh', 'om');
  CREATE TYPE "public"."enum_markets_markets_status" AS ENUM('live', 'soon', 'off');
  CREATE TYPE "public"."enum_markets_markets_currency" AS ENUM('AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR');
  CREATE TYPE "public"."enum_markets_markets_address_scheme" AS ENUM('ae-makani', 'sa-national-address', 'qa-zone', 'kw-paci', 'bh-block', 'om-way');
  CREATE TYPE "public"."enum_markets_markets_fulfilment" AS ENUM('alpha', 'dealer');
  CREATE TYPE "public"."enum__markets_v_version_markets_payments" AS ENUM('card', 'applepay', 'googlepay', 'tabby', 'tamara', 'cod', 'mada', 'naps', 'knet', 'benefitpay', 'omannet');
  CREATE TYPE "public"."enum__markets_v_version_markets_code" AS ENUM('ae', 'sa', 'qa', 'kw', 'bh', 'om');
  CREATE TYPE "public"."enum__markets_v_version_markets_status" AS ENUM('live', 'soon', 'off');
  CREATE TYPE "public"."enum__markets_v_version_markets_currency" AS ENUM('AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR');
  CREATE TYPE "public"."enum__markets_v_version_markets_address_scheme" AS ENUM('ae-makani', 'sa-national-address', 'qa-zone', 'kw-paci', 'bh-block', 'om-way');
  CREATE TYPE "public"."enum__markets_v_version_markets_fulfilment" AS ENUM('alpha', 'dealer');
  CREATE TABLE "legacy_redirects" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"source_path" varchar NOT NULL,
  	"source_query" varchar,
  	"target" varchar NOT NULL,
  	"status" "enum_legacy_redirects_status" DEFAULT '301' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "markets_markets_enabled_locales" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "enum_markets_markets_enabled_locales",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "markets_markets_payments" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "enum_markets_markets_payments",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "markets_markets" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"code" "enum_markets_markets_code" NOT NULL,
  	"status" "enum_markets_markets_status" DEFAULT 'soon' NOT NULL,
  	"currency" "enum_markets_markets_currency" NOT NULL,
  	"decimals" numeric NOT NULL,
  	"vat_rate" numeric NOT NULL,
  	"timezone" varchar NOT NULL,
  	"address_scheme" "enum_markets_markets_address_scheme" NOT NULL,
  	"fulfilment" "enum_markets_markets_fulfilment" NOT NULL
  );
  
  CREATE TABLE "markets_markets_locales" (
  	"name" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "markets" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_markets_markets_enabled_locales_v" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_markets_markets_enabled_locales",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_markets_v_version_markets_payments" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__markets_v_version_markets_payments",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_markets_v_version_markets" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" "enum__markets_v_version_markets_code" NOT NULL,
  	"status" "enum__markets_v_version_markets_status" DEFAULT 'soon' NOT NULL,
  	"currency" "enum__markets_v_version_markets_currency" NOT NULL,
  	"decimals" numeric NOT NULL,
  	"vat_rate" numeric NOT NULL,
  	"timezone" varchar NOT NULL,
  	"address_scheme" "enum__markets_v_version_markets_address_scheme" NOT NULL,
  	"fulfilment" "enum__markets_v_version_markets_fulfilment" NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_markets_v_version_markets_locales" (
  	"name" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_markets_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "legacy_redirects_id" integer;
  ALTER TABLE "markets_markets_enabled_locales" ADD CONSTRAINT "markets_markets_enabled_locales_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."markets_markets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "markets_markets_payments" ADD CONSTRAINT "markets_markets_payments_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."markets_markets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "markets_markets" ADD CONSTRAINT "markets_markets_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."markets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "markets_markets_locales" ADD CONSTRAINT "markets_markets_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."markets_markets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_markets_markets_enabled_locales_v" ADD CONSTRAINT "_markets_markets_enabled_locales_v_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_markets_v_version_markets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_markets_v_version_markets_payments" ADD CONSTRAINT "_markets_v_version_markets_payments_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_markets_v_version_markets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_markets_v_version_markets" ADD CONSTRAINT "_markets_v_version_markets_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_markets_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_markets_v_version_markets_locales" ADD CONSTRAINT "_markets_v_version_markets_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_markets_v_version_markets"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "legacy_redirects_source_path_idx" ON "legacy_redirects" USING btree ("source_path");
  CREATE INDEX "legacy_redirects_updated_at_idx" ON "legacy_redirects" USING btree ("updated_at");
  CREATE INDEX "legacy_redirects_created_at_idx" ON "legacy_redirects" USING btree ("created_at");
  CREATE UNIQUE INDEX "sourcePath_sourceQuery_idx" ON "legacy_redirects" USING btree ("source_path","source_query");
  CREATE INDEX "markets_markets_enabled_locales_order_idx" ON "markets_markets_enabled_locales" USING btree ("order");
  CREATE INDEX "markets_markets_enabled_locales_parent_idx" ON "markets_markets_enabled_locales" USING btree ("parent_id");
  CREATE INDEX "markets_markets_payments_order_idx" ON "markets_markets_payments" USING btree ("order");
  CREATE INDEX "markets_markets_payments_parent_idx" ON "markets_markets_payments" USING btree ("parent_id");
  CREATE INDEX "markets_markets_order_idx" ON "markets_markets" USING btree ("_order");
  CREATE INDEX "markets_markets_parent_id_idx" ON "markets_markets" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "markets_markets_locales_locale_parent_id_unique" ON "markets_markets_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_markets_markets_enabled_locales_v_order_idx" ON "_markets_markets_enabled_locales_v" USING btree ("order");
  CREATE INDEX "_markets_markets_enabled_locales_v_parent_idx" ON "_markets_markets_enabled_locales_v" USING btree ("parent_id");
  CREATE INDEX "_markets_v_version_markets_payments_order_idx" ON "_markets_v_version_markets_payments" USING btree ("order");
  CREATE INDEX "_markets_v_version_markets_payments_parent_idx" ON "_markets_v_version_markets_payments" USING btree ("parent_id");
  CREATE INDEX "_markets_v_version_markets_order_idx" ON "_markets_v_version_markets" USING btree ("_order");
  CREATE INDEX "_markets_v_version_markets_parent_id_idx" ON "_markets_v_version_markets" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_markets_v_version_markets_locales_locale_parent_id_unique" ON "_markets_v_version_markets_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_markets_v_created_at_idx" ON "_markets_v" USING btree ("created_at");
  CREATE INDEX "_markets_v_updated_at_idx" ON "_markets_v" USING btree ("updated_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_legacy_redirects_fk" FOREIGN KEY ("legacy_redirects_id") REFERENCES "public"."legacy_redirects"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_legacy_redirects_id_idx" ON "payload_locked_documents_rels" USING btree ("legacy_redirects_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "legacy_redirects" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "markets_markets_enabled_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "markets_markets_payments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "markets_markets" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "markets_markets_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "markets" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_markets_markets_enabled_locales_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_markets_v_version_markets_payments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_markets_v_version_markets" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_markets_v_version_markets_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_markets_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "legacy_redirects" CASCADE;
  DROP TABLE "markets_markets_enabled_locales" CASCADE;
  DROP TABLE "markets_markets_payments" CASCADE;
  DROP TABLE "markets_markets" CASCADE;
  DROP TABLE "markets_markets_locales" CASCADE;
  DROP TABLE "markets" CASCADE;
  DROP TABLE "_markets_markets_enabled_locales_v" CASCADE;
  DROP TABLE "_markets_v_version_markets_payments" CASCADE;
  DROP TABLE "_markets_v_version_markets" CASCADE;
  DROP TABLE "_markets_v_version_markets_locales" CASCADE;
  DROP TABLE "_markets_v" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_legacy_redirects_fk";
  
  DROP INDEX "payload_locked_documents_rels_legacy_redirects_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "legacy_redirects_id";
  DROP TYPE "public"."enum_legacy_redirects_status";
  DROP TYPE "public"."enum_markets_markets_enabled_locales";
  DROP TYPE "public"."enum_markets_markets_payments";
  DROP TYPE "public"."enum_markets_markets_code";
  DROP TYPE "public"."enum_markets_markets_status";
  DROP TYPE "public"."enum_markets_markets_currency";
  DROP TYPE "public"."enum_markets_markets_address_scheme";
  DROP TYPE "public"."enum_markets_markets_fulfilment";
  DROP TYPE "public"."enum__markets_v_version_markets_payments";
  DROP TYPE "public"."enum__markets_v_version_markets_code";
  DROP TYPE "public"."enum__markets_v_version_markets_status";
  DROP TYPE "public"."enum__markets_v_version_markets_currency";
  DROP TYPE "public"."enum__markets_v_version_markets_address_scheme";
  DROP TYPE "public"."enum__markets_v_version_markets_fulfilment";`)
}
