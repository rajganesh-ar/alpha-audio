import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_brand_agreements_compliance_flags" AS ENUM('origin-restriction', 'registration-pending', 'arabic-labelling', 'wireless-type-approval');
  CREATE TYPE "public"."enum_brand_agreements_market" AS ENUM('ae', 'sa', 'qa', 'kw', 'bh', 'om');
  CREATE TYPE "public"."enum_brand_agreements_role" AS ENUM('distributor', 'retailer', 'none');
  CREATE TYPE "public"."enum_brand_agreements_lead_routing" AS ENUM('alpha', 'dealer');
  CREATE TABLE "brand_agreements_compliance_flags" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_brand_agreements_compliance_flags",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "brand_agreements" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"brand_id" integer NOT NULL,
  	"market" "enum_brand_agreements_market" NOT NULL,
  	"role" "enum_brand_agreements_role" DEFAULT 'distributor' NOT NULL,
  	"exclusive" boolean DEFAULT false,
  	"valid_from" timestamp(3) with time zone,
  	"valid_to" timestamp(3) with time zone,
  	"lead_routing" "enum_brand_agreements_lead_routing" DEFAULT 'alpha' NOT NULL,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "brand_agreements_id" integer;
  ALTER TABLE "brand_agreements_compliance_flags" ADD CONSTRAINT "brand_agreements_compliance_flags_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."brand_agreements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "brand_agreements" ADD CONSTRAINT "brand_agreements_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "brand_agreements_compliance_flags_order_idx" ON "brand_agreements_compliance_flags" USING btree ("order");
  CREATE INDEX "brand_agreements_compliance_flags_parent_idx" ON "brand_agreements_compliance_flags" USING btree ("parent_id");
  CREATE INDEX "brand_agreements_brand_idx" ON "brand_agreements" USING btree ("brand_id");
  CREATE INDEX "brand_agreements_updated_at_idx" ON "brand_agreements" USING btree ("updated_at");
  CREATE INDEX "brand_agreements_created_at_idx" ON "brand_agreements" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_brand_agreements_fk" FOREIGN KEY ("brand_agreements_id") REFERENCES "public"."brand_agreements"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_brand_agreements_id_idx" ON "payload_locked_documents_rels" USING btree ("brand_agreements_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "brand_agreements_compliance_flags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "brand_agreements" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "brand_agreements_compliance_flags" CASCADE;
  DROP TABLE "brand_agreements" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_brand_agreements_fk";
  
  DROP INDEX "payload_locked_documents_rels_brand_agreements_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "brand_agreements_id";
  DROP TYPE "public"."enum_brand_agreements_compliance_flags";
  DROP TYPE "public"."enum_brand_agreements_market";
  DROP TYPE "public"."enum_brand_agreements_role";
  DROP TYPE "public"."enum_brand_agreements_lead_routing";`)
}
