import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_products_markets_market" AS ENUM('ae', 'sa', 'qa', 'kw', 'bh', 'om');
  CREATE TYPE "public"."enum_products_markets_price_display" AS ENUM('show', 'request');
  CREATE TYPE "public"."enum_products_lifecycle" AS ENUM('active', 'discontinued');
  CREATE TYPE "public"."enum_products_arabic_review" AS ENUM('draft', 'reviewed');
  CREATE TYPE "public"."enum_products_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__products_v_version_markets_market" AS ENUM('ae', 'sa', 'qa', 'kw', 'bh', 'om');
  CREATE TYPE "public"."enum__products_v_version_markets_price_display" AS ENUM('show', 'request');
  CREATE TYPE "public"."enum__products_v_version_lifecycle" AS ENUM('active', 'discontinued');
  CREATE TYPE "public"."enum__products_v_version_arabic_review" AS ENUM('draft', 'reviewed');
  CREATE TYPE "public"."enum__products_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__products_v_published_locale" AS ENUM('en', 'ar');
  CREATE TYPE "public"."enum_brands_price_display" AS ENUM('show', 'request');
  CREATE TYPE "public"."enum_brands_arabic_review" AS ENUM('draft', 'reviewed');
  CREATE TYPE "public"."enum_brands_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__brands_v_version_price_display" AS ENUM('show', 'request');
  CREATE TYPE "public"."enum__brands_v_version_arabic_review" AS ENUM('draft', 'reviewed');
  CREATE TYPE "public"."enum__brands_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__brands_v_published_locale" AS ENUM('en', 'ar');
  CREATE TYPE "public"."enum_categories_arabic_review" AS ENUM('draft', 'reviewed');
  CREATE TYPE "public"."enum_categories_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__categories_v_version_arabic_review" AS ENUM('draft', 'reviewed');
  CREATE TYPE "public"."enum__categories_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__categories_v_published_locale" AS ENUM('en', 'ar');
  CREATE TYPE "public"."enum_home_entry_cards_tool" AS ENUM('advisor', 'room-lab', 'builder');
  CREATE TYPE "public"."enum_home_arabic_review" AS ENUM('draft', 'reviewed');
  CREATE TYPE "public"."enum_home_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__home_v_version_entry_cards_tool" AS ENUM('advisor', 'room-lab', 'builder');
  CREATE TYPE "public"."enum__home_v_version_arabic_review" AS ENUM('draft', 'reviewed');
  CREATE TYPE "public"."enum__home_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__home_v_published_locale" AS ENUM('en', 'ar');
  CREATE TABLE "products_markets" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"market" "enum_products_markets_market",
  	"published" boolean DEFAULT false,
  	"rrp_incl_vat" numeric,
  	"price_display" "enum_products_markets_price_display" DEFAULT 'show'
  );
  
  CREATE TABLE "products" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"brand_id" integer,
  	"sku" varchar,
  	"lifecycle" "enum_products_lifecycle" DEFAULT 'active',
  	"specs_power_w" numeric,
  	"specs_channels" numeric,
  	"specs_impedance_ohm" numeric,
  	"specs_min_impedance_ohm" numeric,
  	"specs_sensitivity_db" numeric,
  	"specs_frequency_low_hz" numeric,
  	"specs_frequency_high_hz" numeric,
  	"specs_weight_kg" numeric,
  	"specs_dimensions_mm_width" numeric,
  	"specs_dimensions_mm_height" numeric,
  	"specs_dimensions_mm_depth" numeric,
  	"cost" numeric,
  	"arabic_review" "enum_products_arabic_review" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_products_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "products_locales" (
  	"title" varchar,
  	"summary" varchar,
  	"specs_inputs" varchar,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "products_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer,
  	"media_id" integer
  );
  
  CREATE TABLE "_products_v_version_markets" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"market" "enum__products_v_version_markets_market",
  	"published" boolean DEFAULT false,
  	"rrp_incl_vat" numeric,
  	"price_display" "enum__products_v_version_markets_price_display" DEFAULT 'show',
  	"_uuid" varchar
  );
  
  CREATE TABLE "_products_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_slug" varchar,
  	"version_brand_id" integer,
  	"version_sku" varchar,
  	"version_lifecycle" "enum__products_v_version_lifecycle" DEFAULT 'active',
  	"version_specs_power_w" numeric,
  	"version_specs_channels" numeric,
  	"version_specs_impedance_ohm" numeric,
  	"version_specs_min_impedance_ohm" numeric,
  	"version_specs_sensitivity_db" numeric,
  	"version_specs_frequency_low_hz" numeric,
  	"version_specs_frequency_high_hz" numeric,
  	"version_specs_weight_kg" numeric,
  	"version_specs_dimensions_mm_width" numeric,
  	"version_specs_dimensions_mm_height" numeric,
  	"version_specs_dimensions_mm_depth" numeric,
  	"version_cost" numeric,
  	"version_arabic_review" "enum__products_v_version_arabic_review" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__products_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__products_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_products_v_locales" (
  	"version_title" varchar,
  	"version_summary" varchar,
  	"version_specs_inputs" varchar,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_products_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer,
  	"media_id" integer
  );
  
  CREATE TABLE "brands" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"slug" varchar,
  	"logo_id" integer,
  	"price_display" "enum_brands_price_display" DEFAULT 'show',
  	"arabic_review" "enum_brands_arabic_review" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_brands_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "brands_locales" (
  	"story" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_brands_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_name" varchar,
  	"version_slug" varchar,
  	"version_logo_id" integer,
  	"version_price_display" "enum__brands_v_version_price_display" DEFAULT 'show',
  	"version_arabic_review" "enum__brands_v_version_arabic_review" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__brands_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__brands_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_brands_v_locales" (
  	"version_story" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"parent_id" integer,
  	"order" numeric DEFAULT 100,
  	"arabic_review" "enum_categories_arabic_review" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_categories_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "categories_locales" (
  	"title" varchar,
  	"summary" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_categories_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_slug" varchar,
  	"version_parent_id" integer,
  	"version_order" numeric DEFAULT 100,
  	"version_arabic_review" "enum__categories_v_version_arabic_review" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__categories_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__categories_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_categories_v_locales" (
  	"version_title" varchar,
  	"version_summary" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "home_entry_cards" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tool" "enum_home_entry_cards_tool"
  );
  
  CREATE TABLE "home_entry_cards_locales" (
  	"title" varchar,
  	"body" varchar,
  	"cta_label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "home" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_poster_id" integer,
  	"hero_cta_href" varchar,
  	"arabic_review" "enum_home_arabic_review" DEFAULT 'draft',
  	"_status" "enum_home_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "home_locales" (
  	"hero_eyebrow" varchar,
  	"hero_headline" varchar,
  	"hero_lede" varchar,
  	"hero_cta_label" varchar,
  	"featured_title" varchar,
  	"categories_title" varchar,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "home_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer,
  	"categories_id" integer
  );
  
  CREATE TABLE "_home_v_version_entry_cards" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"tool" "enum__home_v_version_entry_cards_tool",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_home_v_version_entry_cards_locales" (
  	"title" varchar,
  	"body" varchar,
  	"cta_label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_home_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_hero_poster_id" integer,
  	"version_hero_cta_href" varchar,
  	"version_arabic_review" "enum__home_v_version_arabic_review" DEFAULT 'draft',
  	"version__status" "enum__home_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__home_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_home_v_locales" (
  	"version_hero_eyebrow" varchar,
  	"version_hero_headline" varchar,
  	"version_hero_lede" varchar,
  	"version_hero_cta_label" varchar,
  	"version_featured_title" varchar,
  	"version_categories_title" varchar,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_home_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer,
  	"categories_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "products_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "brands_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "categories_id" integer;
  ALTER TABLE "products_markets" ADD CONSTRAINT "products_markets_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_locales" ADD CONSTRAINT "products_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_version_markets" ADD CONSTRAINT "_products_v_version_markets_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v" ADD CONSTRAINT "_products_v_parent_id_products_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_products_v" ADD CONSTRAINT "_products_v_version_brand_id_brands_id_fk" FOREIGN KEY ("version_brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_products_v_locales" ADD CONSTRAINT "_products_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_rels" ADD CONSTRAINT "_products_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_rels" ADD CONSTRAINT "_products_v_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_rels" ADD CONSTRAINT "_products_v_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "brands" ADD CONSTRAINT "brands_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "brands_locales" ADD CONSTRAINT "brands_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_brands_v" ADD CONSTRAINT "_brands_v_parent_id_brands_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_brands_v" ADD CONSTRAINT "_brands_v_version_logo_id_media_id_fk" FOREIGN KEY ("version_logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_brands_v_locales" ADD CONSTRAINT "_brands_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_brands_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories_locales" ADD CONSTRAINT "categories_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_categories_v" ADD CONSTRAINT "_categories_v_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_categories_v" ADD CONSTRAINT "_categories_v_version_parent_id_categories_id_fk" FOREIGN KEY ("version_parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_categories_v_locales" ADD CONSTRAINT "_categories_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_categories_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_entry_cards" ADD CONSTRAINT "home_entry_cards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_entry_cards_locales" ADD CONSTRAINT "home_entry_cards_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home_entry_cards"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home" ADD CONSTRAINT "home_hero_poster_id_media_id_fk" FOREIGN KEY ("hero_poster_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home_locales" ADD CONSTRAINT "home_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_rels" ADD CONSTRAINT "home_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_rels" ADD CONSTRAINT "home_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_rels" ADD CONSTRAINT "home_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_version_entry_cards" ADD CONSTRAINT "_home_v_version_entry_cards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_version_entry_cards_locales" ADD CONSTRAINT "_home_v_version_entry_cards_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v_version_entry_cards"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v" ADD CONSTRAINT "_home_v_version_hero_poster_id_media_id_fk" FOREIGN KEY ("version_hero_poster_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_v_locales" ADD CONSTRAINT "_home_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_rels" ADD CONSTRAINT "_home_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_home_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_rels" ADD CONSTRAINT "_home_v_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_rels" ADD CONSTRAINT "_home_v_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "products_markets_order_idx" ON "products_markets" USING btree ("_order");
  CREATE INDEX "products_markets_parent_id_idx" ON "products_markets" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "products_slug_idx" ON "products" USING btree ("slug");
  CREATE INDEX "products_brand_idx" ON "products" USING btree ("brand_id");
  CREATE UNIQUE INDEX "products_sku_idx" ON "products" USING btree ("sku");
  CREATE INDEX "products_updated_at_idx" ON "products" USING btree ("updated_at");
  CREATE INDEX "products_created_at_idx" ON "products" USING btree ("created_at");
  CREATE INDEX "products__status_idx" ON "products" USING btree ("_status");
  CREATE UNIQUE INDEX "products_locales_locale_parent_id_unique" ON "products_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "products_rels_order_idx" ON "products_rels" USING btree ("order");
  CREATE INDEX "products_rels_parent_idx" ON "products_rels" USING btree ("parent_id");
  CREATE INDEX "products_rels_path_idx" ON "products_rels" USING btree ("path");
  CREATE INDEX "products_rels_categories_id_idx" ON "products_rels" USING btree ("categories_id");
  CREATE INDEX "products_rels_media_id_idx" ON "products_rels" USING btree ("media_id");
  CREATE INDEX "_products_v_version_markets_order_idx" ON "_products_v_version_markets" USING btree ("_order");
  CREATE INDEX "_products_v_version_markets_parent_id_idx" ON "_products_v_version_markets" USING btree ("_parent_id");
  CREATE INDEX "_products_v_parent_idx" ON "_products_v" USING btree ("parent_id");
  CREATE INDEX "_products_v_version_version_slug_idx" ON "_products_v" USING btree ("version_slug");
  CREATE INDEX "_products_v_version_version_brand_idx" ON "_products_v" USING btree ("version_brand_id");
  CREATE INDEX "_products_v_version_version_sku_idx" ON "_products_v" USING btree ("version_sku");
  CREATE INDEX "_products_v_version_version_updated_at_idx" ON "_products_v" USING btree ("version_updated_at");
  CREATE INDEX "_products_v_version_version_created_at_idx" ON "_products_v" USING btree ("version_created_at");
  CREATE INDEX "_products_v_version_version__status_idx" ON "_products_v" USING btree ("version__status");
  CREATE INDEX "_products_v_created_at_idx" ON "_products_v" USING btree ("created_at");
  CREATE INDEX "_products_v_updated_at_idx" ON "_products_v" USING btree ("updated_at");
  CREATE INDEX "_products_v_snapshot_idx" ON "_products_v" USING btree ("snapshot");
  CREATE INDEX "_products_v_published_locale_idx" ON "_products_v" USING btree ("published_locale");
  CREATE INDEX "_products_v_latest_idx" ON "_products_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_products_v_locales_locale_parent_id_unique" ON "_products_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_products_v_rels_order_idx" ON "_products_v_rels" USING btree ("order");
  CREATE INDEX "_products_v_rels_parent_idx" ON "_products_v_rels" USING btree ("parent_id");
  CREATE INDEX "_products_v_rels_path_idx" ON "_products_v_rels" USING btree ("path");
  CREATE INDEX "_products_v_rels_categories_id_idx" ON "_products_v_rels" USING btree ("categories_id");
  CREATE INDEX "_products_v_rels_media_id_idx" ON "_products_v_rels" USING btree ("media_id");
  CREATE UNIQUE INDEX "brands_slug_idx" ON "brands" USING btree ("slug");
  CREATE INDEX "brands_logo_idx" ON "brands" USING btree ("logo_id");
  CREATE INDEX "brands_updated_at_idx" ON "brands" USING btree ("updated_at");
  CREATE INDEX "brands_created_at_idx" ON "brands" USING btree ("created_at");
  CREATE INDEX "brands__status_idx" ON "brands" USING btree ("_status");
  CREATE UNIQUE INDEX "brands_locales_locale_parent_id_unique" ON "brands_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_brands_v_parent_idx" ON "_brands_v" USING btree ("parent_id");
  CREATE INDEX "_brands_v_version_version_slug_idx" ON "_brands_v" USING btree ("version_slug");
  CREATE INDEX "_brands_v_version_version_logo_idx" ON "_brands_v" USING btree ("version_logo_id");
  CREATE INDEX "_brands_v_version_version_updated_at_idx" ON "_brands_v" USING btree ("version_updated_at");
  CREATE INDEX "_brands_v_version_version_created_at_idx" ON "_brands_v" USING btree ("version_created_at");
  CREATE INDEX "_brands_v_version_version__status_idx" ON "_brands_v" USING btree ("version__status");
  CREATE INDEX "_brands_v_created_at_idx" ON "_brands_v" USING btree ("created_at");
  CREATE INDEX "_brands_v_updated_at_idx" ON "_brands_v" USING btree ("updated_at");
  CREATE INDEX "_brands_v_snapshot_idx" ON "_brands_v" USING btree ("snapshot");
  CREATE INDEX "_brands_v_published_locale_idx" ON "_brands_v" USING btree ("published_locale");
  CREATE INDEX "_brands_v_latest_idx" ON "_brands_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_brands_v_locales_locale_parent_id_unique" ON "_brands_v_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");
  CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");
  CREATE INDEX "categories_updated_at_idx" ON "categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "categories" USING btree ("created_at");
  CREATE INDEX "categories__status_idx" ON "categories" USING btree ("_status");
  CREATE UNIQUE INDEX "categories_locales_locale_parent_id_unique" ON "categories_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_categories_v_parent_idx" ON "_categories_v" USING btree ("parent_id");
  CREATE INDEX "_categories_v_version_version_slug_idx" ON "_categories_v" USING btree ("version_slug");
  CREATE INDEX "_categories_v_version_version_parent_idx" ON "_categories_v" USING btree ("version_parent_id");
  CREATE INDEX "_categories_v_version_version_updated_at_idx" ON "_categories_v" USING btree ("version_updated_at");
  CREATE INDEX "_categories_v_version_version_created_at_idx" ON "_categories_v" USING btree ("version_created_at");
  CREATE INDEX "_categories_v_version_version__status_idx" ON "_categories_v" USING btree ("version__status");
  CREATE INDEX "_categories_v_created_at_idx" ON "_categories_v" USING btree ("created_at");
  CREATE INDEX "_categories_v_updated_at_idx" ON "_categories_v" USING btree ("updated_at");
  CREATE INDEX "_categories_v_snapshot_idx" ON "_categories_v" USING btree ("snapshot");
  CREATE INDEX "_categories_v_published_locale_idx" ON "_categories_v" USING btree ("published_locale");
  CREATE INDEX "_categories_v_latest_idx" ON "_categories_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_categories_v_locales_locale_parent_id_unique" ON "_categories_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "home_entry_cards_order_idx" ON "home_entry_cards" USING btree ("_order");
  CREATE INDEX "home_entry_cards_parent_id_idx" ON "home_entry_cards" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "home_entry_cards_locales_locale_parent_id_unique" ON "home_entry_cards_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "home_hero_hero_poster_idx" ON "home" USING btree ("hero_poster_id");
  CREATE INDEX "home__status_idx" ON "home" USING btree ("_status");
  CREATE UNIQUE INDEX "home_locales_locale_parent_id_unique" ON "home_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "home_rels_order_idx" ON "home_rels" USING btree ("order");
  CREATE INDEX "home_rels_parent_idx" ON "home_rels" USING btree ("parent_id");
  CREATE INDEX "home_rels_path_idx" ON "home_rels" USING btree ("path");
  CREATE INDEX "home_rels_products_id_idx" ON "home_rels" USING btree ("products_id");
  CREATE INDEX "home_rels_categories_id_idx" ON "home_rels" USING btree ("categories_id");
  CREATE INDEX "_home_v_version_entry_cards_order_idx" ON "_home_v_version_entry_cards" USING btree ("_order");
  CREATE INDEX "_home_v_version_entry_cards_parent_id_idx" ON "_home_v_version_entry_cards" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_home_v_version_entry_cards_locales_locale_parent_id_unique" ON "_home_v_version_entry_cards_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_home_v_version_hero_version_hero_poster_idx" ON "_home_v" USING btree ("version_hero_poster_id");
  CREATE INDEX "_home_v_version_version__status_idx" ON "_home_v" USING btree ("version__status");
  CREATE INDEX "_home_v_created_at_idx" ON "_home_v" USING btree ("created_at");
  CREATE INDEX "_home_v_updated_at_idx" ON "_home_v" USING btree ("updated_at");
  CREATE INDEX "_home_v_snapshot_idx" ON "_home_v" USING btree ("snapshot");
  CREATE INDEX "_home_v_published_locale_idx" ON "_home_v" USING btree ("published_locale");
  CREATE INDEX "_home_v_latest_idx" ON "_home_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_home_v_locales_locale_parent_id_unique" ON "_home_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_home_v_rels_order_idx" ON "_home_v_rels" USING btree ("order");
  CREATE INDEX "_home_v_rels_parent_idx" ON "_home_v_rels" USING btree ("parent_id");
  CREATE INDEX "_home_v_rels_path_idx" ON "_home_v_rels" USING btree ("path");
  CREATE INDEX "_home_v_rels_products_id_idx" ON "_home_v_rels" USING btree ("products_id");
  CREATE INDEX "_home_v_rels_categories_id_idx" ON "_home_v_rels" USING btree ("categories_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_brands_fk" FOREIGN KEY ("brands_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_products_id_idx" ON "payload_locked_documents_rels" USING btree ("products_id");
  CREATE INDEX "payload_locked_documents_rels_brands_id_idx" ON "payload_locked_documents_rels" USING btree ("brands_id");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("categories_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products_markets" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_products_v_version_markets" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_products_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_products_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_products_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "brands" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "brands_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_brands_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_brands_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "categories" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "categories_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_categories_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_categories_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "home_entry_cards" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "home_entry_cards_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "home" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "home_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "home_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_home_v_version_entry_cards" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_home_v_version_entry_cards_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_home_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_home_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_home_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "products_markets" CASCADE;
  DROP TABLE "products" CASCADE;
  DROP TABLE "products_locales" CASCADE;
  DROP TABLE "products_rels" CASCADE;
  DROP TABLE "_products_v_version_markets" CASCADE;
  DROP TABLE "_products_v" CASCADE;
  DROP TABLE "_products_v_locales" CASCADE;
  DROP TABLE "_products_v_rels" CASCADE;
  DROP TABLE "brands" CASCADE;
  DROP TABLE "brands_locales" CASCADE;
  DROP TABLE "_brands_v" CASCADE;
  DROP TABLE "_brands_v_locales" CASCADE;
  DROP TABLE "categories" CASCADE;
  DROP TABLE "categories_locales" CASCADE;
  DROP TABLE "_categories_v" CASCADE;
  DROP TABLE "_categories_v_locales" CASCADE;
  DROP TABLE "home_entry_cards" CASCADE;
  DROP TABLE "home_entry_cards_locales" CASCADE;
  DROP TABLE "home" CASCADE;
  DROP TABLE "home_locales" CASCADE;
  DROP TABLE "home_rels" CASCADE;
  DROP TABLE "_home_v_version_entry_cards" CASCADE;
  DROP TABLE "_home_v_version_entry_cards_locales" CASCADE;
  DROP TABLE "_home_v" CASCADE;
  DROP TABLE "_home_v_locales" CASCADE;
  DROP TABLE "_home_v_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_products_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_brands_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_categories_fk";
  
  DROP INDEX "payload_locked_documents_rels_products_id_idx";
  DROP INDEX "payload_locked_documents_rels_brands_id_idx";
  DROP INDEX "payload_locked_documents_rels_categories_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "products_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "brands_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "categories_id";
  DROP TYPE "public"."enum_products_markets_market";
  DROP TYPE "public"."enum_products_markets_price_display";
  DROP TYPE "public"."enum_products_lifecycle";
  DROP TYPE "public"."enum_products_arabic_review";
  DROP TYPE "public"."enum_products_status";
  DROP TYPE "public"."enum__products_v_version_markets_market";
  DROP TYPE "public"."enum__products_v_version_markets_price_display";
  DROP TYPE "public"."enum__products_v_version_lifecycle";
  DROP TYPE "public"."enum__products_v_version_arabic_review";
  DROP TYPE "public"."enum__products_v_version_status";
  DROP TYPE "public"."enum__products_v_published_locale";
  DROP TYPE "public"."enum_brands_price_display";
  DROP TYPE "public"."enum_brands_arabic_review";
  DROP TYPE "public"."enum_brands_status";
  DROP TYPE "public"."enum__brands_v_version_price_display";
  DROP TYPE "public"."enum__brands_v_version_arabic_review";
  DROP TYPE "public"."enum__brands_v_version_status";
  DROP TYPE "public"."enum__brands_v_published_locale";
  DROP TYPE "public"."enum_categories_arabic_review";
  DROP TYPE "public"."enum_categories_status";
  DROP TYPE "public"."enum__categories_v_version_arabic_review";
  DROP TYPE "public"."enum__categories_v_version_status";
  DROP TYPE "public"."enum__categories_v_published_locale";
  DROP TYPE "public"."enum_home_entry_cards_tool";
  DROP TYPE "public"."enum_home_arabic_review";
  DROP TYPE "public"."enum_home_status";
  DROP TYPE "public"."enum__home_v_version_entry_cards_tool";
  DROP TYPE "public"."enum__home_v_version_arabic_review";
  DROP TYPE "public"."enum__home_v_version_status";
  DROP TYPE "public"."enum__home_v_published_locale";`)
}
