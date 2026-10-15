import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_company_users_locale" AS ENUM('en', 'ar');
  ALTER TABLE "company_users" ADD COLUMN "locale" "enum_company_users_locale" DEFAULT 'en' NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "company_users" DROP COLUMN "locale";
  DROP TYPE "public"."enum_company_users_locale";`)
}
