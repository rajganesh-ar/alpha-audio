import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_categories_facet_specs" AS ENUM('channels', 'impedanceOhm', 'minImpedanceOhm', 'sensitivityDb', 'powerW');
  CREATE TYPE "public"."enum__categories_v_version_facet_specs" AS ENUM('channels', 'impedanceOhm', 'minImpedanceOhm', 'sensitivityDb', 'powerW');
  CREATE TABLE "categories_facet_specs" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_categories_facet_specs",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_categories_v_version_facet_specs" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__categories_v_version_facet_specs",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  ALTER TABLE "categories_facet_specs" ADD CONSTRAINT "categories_facet_specs_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_categories_v_version_facet_specs" ADD CONSTRAINT "_categories_v_version_facet_specs_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_categories_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "categories_facet_specs_order_idx" ON "categories_facet_specs" USING btree ("order");
  CREATE INDEX "categories_facet_specs_parent_idx" ON "categories_facet_specs" USING btree ("parent_id");
  CREATE INDEX "_categories_v_version_facet_specs_order_idx" ON "_categories_v_version_facet_specs" USING btree ("order");
  CREATE INDEX "_categories_v_version_facet_specs_parent_idx" ON "_categories_v_version_facet_specs" USING btree ("parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "categories_facet_specs" CASCADE;
  DROP TABLE "_categories_v_version_facet_specs" CASCADE;
  DROP TYPE "public"."enum_categories_facet_specs";
  DROP TYPE "public"."enum__categories_v_version_facet_specs";`)
}
