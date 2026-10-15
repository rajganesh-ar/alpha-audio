import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_companies_market" AS ENUM('ae', 'sa', 'qa', 'kw', 'bh', 'om');
  CREATE TYPE "public"."enum_companies_channel" AS ENUM('dealer', 'integrator', 'retailer');
  CREATE TYPE "public"."enum_companies_tier" AS ENUM('gold', 'silver', 'standard');
  CREATE TYPE "public"."enum_companies_settings_stock_visibility" AS ENUM('exact', 'banded', 'hidden');
  CREATE TYPE "public"."enum_company_users_role" AS ENUM('owner', 'purchaser', 'viewer', 'installer');
  CREATE TYPE "public"."enum_price_lists_market" AS ENUM('ae', 'sa', 'qa', 'kw', 'bh', 'om');
  CREATE TYPE "public"."enum_price_lists_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__price_lists_v_version_market" AS ENUM('ae', 'sa', 'qa', 'kw', 'bh', 'om');
  CREATE TYPE "public"."enum__price_lists_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__price_lists_v_published_locale" AS ENUM('en', 'ar');
  CREATE TYPE "public"."enum_price_rules_markets" AS ENUM('ae', 'sa', 'qa', 'kw', 'bh', 'om');
  CREATE TYPE "public"."enum_price_rules_kind" AS ENUM('volume', 'promotion');
  CREATE TYPE "public"."enum_pricing_settings_fx_rates_currency" AS ENUM('SAR', 'QAR', 'KWD', 'BHD', 'OMR');
  CREATE TABLE "companies" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"market" "enum_companies_market" NOT NULL,
  	"channel" "enum_companies_channel" DEFAULT 'dealer' NOT NULL,
  	"tier" "enum_companies_tier" DEFAULT 'standard',
  	"hold" boolean DEFAULT false,
  	"buyer_group_id" integer,
  	"price_list_id" integer,
  	"credit_limit" numeric,
  	"terms_days" numeric DEFAULT 30,
  	"settings_stock_visibility" "enum_companies_settings_stock_visibility" DEFAULT 'banded' NOT NULL,
  	"settings_min_order_value" numeric,
  	"settings_order_multiple" numeric DEFAULT 1,
  	"settings_free_freight_threshold" numeric,
  	"settings_drop_ship_allowed" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "company_users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "company_users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"company_id" integer NOT NULL,
  	"role" "enum_company_users_role" DEFAULT 'viewer' NOT NULL,
  	"approval_threshold" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "contract_prices" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"company_id" integer NOT NULL,
  	"sku" varchar NOT NULL,
  	"price" numeric NOT NULL,
  	"valid_from" timestamp(3) with time zone,
  	"valid_to" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "price_lists_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"sku" varchar,
  	"price" numeric
  );
  
  CREATE TABLE "price_lists" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"market" "enum_price_lists_market",
  	"valid_from" timestamp(3) with time zone,
  	"valid_to" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_price_lists_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_price_lists_v_version_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"sku" varchar,
  	"price" numeric,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_price_lists_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_name" varchar,
  	"version_market" "enum__price_lists_v_version_market",
  	"version_valid_from" timestamp(3) with time zone,
  	"version_valid_to" timestamp(3) with time zone,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__price_lists_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__price_lists_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "buyer_groups_discounts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"brand_id" integer,
  	"category_id" integer,
  	"bps" numeric NOT NULL
  );
  
  CREATE TABLE "buyer_groups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"price_list_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "price_rules_markets" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_price_rules_markets",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "price_rules" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"kind" "enum_price_rules_kind" NOT NULL,
  	"sku" varchar,
  	"brand_id" integer,
  	"min_qty" numeric DEFAULT 1 NOT NULL,
  	"bps" numeric NOT NULL,
  	"stackable" boolean DEFAULT false,
  	"valid_from" timestamp(3) with time zone,
  	"valid_to" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pricing_settings_fx_rates" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"currency" "enum_pricing_settings_fx_rates_currency" NOT NULL,
  	"aed_per_unit" varchar NOT NULL
  );
  
  CREATE TABLE "pricing_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"channel_factors_dealer" numeric DEFAULT 7000 NOT NULL,
  	"channel_factors_integrator" numeric DEFAULT 7500 NOT NULL,
  	"channel_factors_retailer" numeric DEFAULT 8000 NOT NULL,
  	"target_margin" numeric DEFAULT 2500 NOT NULL,
  	"margin_floor" numeric DEFAULT 1000 NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "products_markets" ADD COLUMN "map_excl_vat" numeric;
  ALTER TABLE "_products_v_version_markets" ADD COLUMN "map_excl_vat" numeric;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "companies_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "company_users_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "contract_prices_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "price_lists_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "buyer_groups_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "price_rules_id" integer;
  ALTER TABLE "payload_preferences_rels" ADD COLUMN "company_users_id" integer;
  ALTER TABLE "companies" ADD CONSTRAINT "companies_buyer_group_id_buyer_groups_id_fk" FOREIGN KEY ("buyer_group_id") REFERENCES "public"."buyer_groups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "companies" ADD CONSTRAINT "companies_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "company_users_sessions" ADD CONSTRAINT "company_users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."company_users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "company_users" ADD CONSTRAINT "company_users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "contract_prices" ADD CONSTRAINT "contract_prices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "price_lists_items" ADD CONSTRAINT "price_lists_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."price_lists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_price_lists_v_version_items" ADD CONSTRAINT "_price_lists_v_version_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_price_lists_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_price_lists_v" ADD CONSTRAINT "_price_lists_v_parent_id_price_lists_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."price_lists"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "buyer_groups_discounts" ADD CONSTRAINT "buyer_groups_discounts_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "buyer_groups_discounts" ADD CONSTRAINT "buyer_groups_discounts_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "buyer_groups_discounts" ADD CONSTRAINT "buyer_groups_discounts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."buyer_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "buyer_groups" ADD CONSTRAINT "buyer_groups_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "price_rules_markets" ADD CONSTRAINT "price_rules_markets_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."price_rules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pricing_settings_fx_rates" ADD CONSTRAINT "pricing_settings_fx_rates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pricing_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "companies_buyer_group_idx" ON "companies" USING btree ("buyer_group_id");
  CREATE INDEX "companies_price_list_idx" ON "companies" USING btree ("price_list_id");
  CREATE INDEX "companies_updated_at_idx" ON "companies" USING btree ("updated_at");
  CREATE INDEX "companies_created_at_idx" ON "companies" USING btree ("created_at");
  CREATE INDEX "company_users_sessions_order_idx" ON "company_users_sessions" USING btree ("_order");
  CREATE INDEX "company_users_sessions_parent_id_idx" ON "company_users_sessions" USING btree ("_parent_id");
  CREATE INDEX "company_users_company_idx" ON "company_users" USING btree ("company_id");
  CREATE INDEX "company_users_updated_at_idx" ON "company_users" USING btree ("updated_at");
  CREATE INDEX "company_users_created_at_idx" ON "company_users" USING btree ("created_at");
  CREATE UNIQUE INDEX "company_users_email_idx" ON "company_users" USING btree ("email");
  CREATE INDEX "contract_prices_company_idx" ON "contract_prices" USING btree ("company_id");
  CREATE INDEX "contract_prices_updated_at_idx" ON "contract_prices" USING btree ("updated_at");
  CREATE INDEX "contract_prices_created_at_idx" ON "contract_prices" USING btree ("created_at");
  CREATE INDEX "company_sku_idx" ON "contract_prices" USING btree ("company_id","sku");
  CREATE INDEX "price_lists_items_order_idx" ON "price_lists_items" USING btree ("_order");
  CREATE INDEX "price_lists_items_parent_id_idx" ON "price_lists_items" USING btree ("_parent_id");
  CREATE INDEX "price_lists_updated_at_idx" ON "price_lists" USING btree ("updated_at");
  CREATE INDEX "price_lists_created_at_idx" ON "price_lists" USING btree ("created_at");
  CREATE INDEX "price_lists__status_idx" ON "price_lists" USING btree ("_status");
  CREATE INDEX "_price_lists_v_version_items_order_idx" ON "_price_lists_v_version_items" USING btree ("_order");
  CREATE INDEX "_price_lists_v_version_items_parent_id_idx" ON "_price_lists_v_version_items" USING btree ("_parent_id");
  CREATE INDEX "_price_lists_v_parent_idx" ON "_price_lists_v" USING btree ("parent_id");
  CREATE INDEX "_price_lists_v_version_version_updated_at_idx" ON "_price_lists_v" USING btree ("version_updated_at");
  CREATE INDEX "_price_lists_v_version_version_created_at_idx" ON "_price_lists_v" USING btree ("version_created_at");
  CREATE INDEX "_price_lists_v_version_version__status_idx" ON "_price_lists_v" USING btree ("version__status");
  CREATE INDEX "_price_lists_v_created_at_idx" ON "_price_lists_v" USING btree ("created_at");
  CREATE INDEX "_price_lists_v_updated_at_idx" ON "_price_lists_v" USING btree ("updated_at");
  CREATE INDEX "_price_lists_v_snapshot_idx" ON "_price_lists_v" USING btree ("snapshot");
  CREATE INDEX "_price_lists_v_published_locale_idx" ON "_price_lists_v" USING btree ("published_locale");
  CREATE INDEX "_price_lists_v_latest_idx" ON "_price_lists_v" USING btree ("latest");
  CREATE INDEX "buyer_groups_discounts_order_idx" ON "buyer_groups_discounts" USING btree ("_order");
  CREATE INDEX "buyer_groups_discounts_parent_id_idx" ON "buyer_groups_discounts" USING btree ("_parent_id");
  CREATE INDEX "buyer_groups_discounts_brand_idx" ON "buyer_groups_discounts" USING btree ("brand_id");
  CREATE INDEX "buyer_groups_discounts_category_idx" ON "buyer_groups_discounts" USING btree ("category_id");
  CREATE INDEX "buyer_groups_price_list_idx" ON "buyer_groups" USING btree ("price_list_id");
  CREATE INDEX "buyer_groups_updated_at_idx" ON "buyer_groups" USING btree ("updated_at");
  CREATE INDEX "buyer_groups_created_at_idx" ON "buyer_groups" USING btree ("created_at");
  CREATE INDEX "price_rules_markets_order_idx" ON "price_rules_markets" USING btree ("order");
  CREATE INDEX "price_rules_markets_parent_idx" ON "price_rules_markets" USING btree ("parent_id");
  CREATE INDEX "price_rules_brand_idx" ON "price_rules" USING btree ("brand_id");
  CREATE INDEX "price_rules_updated_at_idx" ON "price_rules" USING btree ("updated_at");
  CREATE INDEX "price_rules_created_at_idx" ON "price_rules" USING btree ("created_at");
  CREATE INDEX "pricing_settings_fx_rates_order_idx" ON "pricing_settings_fx_rates" USING btree ("_order");
  CREATE INDEX "pricing_settings_fx_rates_parent_id_idx" ON "pricing_settings_fx_rates" USING btree ("_parent_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_companies_fk" FOREIGN KEY ("companies_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_company_users_fk" FOREIGN KEY ("company_users_id") REFERENCES "public"."company_users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_contract_prices_fk" FOREIGN KEY ("contract_prices_id") REFERENCES "public"."contract_prices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_price_lists_fk" FOREIGN KEY ("price_lists_id") REFERENCES "public"."price_lists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_buyer_groups_fk" FOREIGN KEY ("buyer_groups_id") REFERENCES "public"."buyer_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_price_rules_fk" FOREIGN KEY ("price_rules_id") REFERENCES "public"."price_rules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_company_users_fk" FOREIGN KEY ("company_users_id") REFERENCES "public"."company_users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_companies_id_idx" ON "payload_locked_documents_rels" USING btree ("companies_id");
  CREATE INDEX "payload_locked_documents_rels_company_users_id_idx" ON "payload_locked_documents_rels" USING btree ("company_users_id");
  CREATE INDEX "payload_locked_documents_rels_contract_prices_id_idx" ON "payload_locked_documents_rels" USING btree ("contract_prices_id");
  CREATE INDEX "payload_locked_documents_rels_price_lists_id_idx" ON "payload_locked_documents_rels" USING btree ("price_lists_id");
  CREATE INDEX "payload_locked_documents_rels_buyer_groups_id_idx" ON "payload_locked_documents_rels" USING btree ("buyer_groups_id");
  CREATE INDEX "payload_locked_documents_rels_price_rules_id_idx" ON "payload_locked_documents_rels" USING btree ("price_rules_id");
  CREATE INDEX "payload_preferences_rels_company_users_id_idx" ON "payload_preferences_rels" USING btree ("company_users_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "companies" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "company_users_sessions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "company_users" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "contract_prices" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "price_lists_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "price_lists" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_price_lists_v_version_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_price_lists_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "buyer_groups_discounts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "buyer_groups" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "price_rules_markets" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "price_rules" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pricing_settings_fx_rates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pricing_settings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "companies" CASCADE;
  DROP TABLE "company_users_sessions" CASCADE;
  DROP TABLE "company_users" CASCADE;
  DROP TABLE "contract_prices" CASCADE;
  DROP TABLE "price_lists_items" CASCADE;
  DROP TABLE "price_lists" CASCADE;
  DROP TABLE "_price_lists_v_version_items" CASCADE;
  DROP TABLE "_price_lists_v" CASCADE;
  DROP TABLE "buyer_groups_discounts" CASCADE;
  DROP TABLE "buyer_groups" CASCADE;
  DROP TABLE "price_rules_markets" CASCADE;
  DROP TABLE "price_rules" CASCADE;
  DROP TABLE "pricing_settings_fx_rates" CASCADE;
  DROP TABLE "pricing_settings" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_companies_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_company_users_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_contract_prices_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_price_lists_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_buyer_groups_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_price_rules_fk";
  
  ALTER TABLE "payload_preferences_rels" DROP CONSTRAINT "payload_preferences_rels_company_users_fk";
  
  DROP INDEX "payload_locked_documents_rels_companies_id_idx";
  DROP INDEX "payload_locked_documents_rels_company_users_id_idx";
  DROP INDEX "payload_locked_documents_rels_contract_prices_id_idx";
  DROP INDEX "payload_locked_documents_rels_price_lists_id_idx";
  DROP INDEX "payload_locked_documents_rels_buyer_groups_id_idx";
  DROP INDEX "payload_locked_documents_rels_price_rules_id_idx";
  DROP INDEX "payload_preferences_rels_company_users_id_idx";
  ALTER TABLE "products_markets" DROP COLUMN "map_excl_vat";
  ALTER TABLE "_products_v_version_markets" DROP COLUMN "map_excl_vat";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "companies_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "company_users_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "contract_prices_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "price_lists_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "buyer_groups_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "price_rules_id";
  ALTER TABLE "payload_preferences_rels" DROP COLUMN "company_users_id";
  DROP TYPE "public"."enum_companies_market";
  DROP TYPE "public"."enum_companies_channel";
  DROP TYPE "public"."enum_companies_tier";
  DROP TYPE "public"."enum_companies_settings_stock_visibility";
  DROP TYPE "public"."enum_company_users_role";
  DROP TYPE "public"."enum_price_lists_market";
  DROP TYPE "public"."enum_price_lists_status";
  DROP TYPE "public"."enum__price_lists_v_version_market";
  DROP TYPE "public"."enum__price_lists_v_version_status";
  DROP TYPE "public"."enum__price_lists_v_published_locale";
  DROP TYPE "public"."enum_price_rules_markets";
  DROP TYPE "public"."enum_price_rules_kind";
  DROP TYPE "public"."enum_pricing_settings_fx_rates_currency";`)
}
