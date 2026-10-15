import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

/**
 * Keyword search over the catalogue (docs/tasks/0011, ADR 0011). One row per product and
 * locale in `product_search`: a weighted `tsvector` (title and brand/SKU A, categories B,
 * summary C, all words unstemmed D) with the English or Arabic stemmer, and a plain `terms` string for typo matching
 * with trigrams. Database triggers keep it in step with every write to products, their locales
 * and categories, brands and category titles, whatever path the write takes.
 *
 * `alpha_search_normalise` must match `normaliseSearchText` in packages/core/search: lower case,
 * Arabic diacritics and tatweel removed, alef forms → ا, ى → ي, ة → ه, Arabic-Indic digits → 0-9.
 * Hand-written: Payload's schema generator cannot express functions, triggers or GIN indexes.
 */
export async function up({ db }: Pick<MigrateUpArgs, 'db'>): Promise<void> {
  await db.execute(sql`
    CREATE EXTENSION IF NOT EXISTS pg_trgm;

    CREATE OR REPLACE FUNCTION alpha_search_normalise(input text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
      SELECT lower(translate(
        regexp_replace(coalesce(input, ''), '[\\u064B-\\u065F\\u0670\\u0640]', '', 'g'),
        'أإآٱىة٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
        'اااايه01234567890123456789'
      ))
    $$;

    CREATE TABLE product_search (
      product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      locale text NOT NULL,
      document tsvector NOT NULL,
      terms text NOT NULL,
      PRIMARY KEY (product_id, locale)
    );
    CREATE INDEX product_search_document_idx ON product_search USING gin (document);
    CREATE INDEX product_search_terms_idx ON product_search USING gin (terms gin_trgm_ops);

    CREATE OR REPLACE FUNCTION alpha_refresh_product_search(pid integer) RETURNS void
    LANGUAGE plpgsql AS $$
    BEGIN
      DELETE FROM product_search WHERE product_id = pid;
      INSERT INTO product_search (product_id, locale, document, terms)
      SELECT p.id, l.code,
        setweight(to_tsvector(l.cfg, alpha_search_normalise(coalesce(pl.title, en.title, ''))), 'A') ||
        setweight(to_tsvector('simple', alpha_search_normalise(concat_ws(' ', b.name, p.sku))), 'A') ||
        setweight(to_tsvector(l.cfg, alpha_search_normalise(coalesce(cats.titles, ''))), 'B') ||
        setweight(to_tsvector('english', alpha_search_normalise(CASE WHEN l.code = 'en' THEN '' ELSE coalesce(en.title, '') END)), 'B') ||
        setweight(to_tsvector(l.cfg, alpha_search_normalise(coalesce(pl.summary, en.summary, ''))), 'C') ||
        -- Unstemmed words too, so a prefix typed mid-word ("integrat") still matches.
        setweight(to_tsvector('simple', alpha_search_normalise(concat_ws(' ', pl.title, en.title, cats.titles, pl.summary))), 'D'),
        alpha_search_normalise(concat_ws(' ', b.name, p.sku, pl.title, en.title, cats.titles))
      FROM products p
      CROSS JOIN (VALUES ('en', 'english'::regconfig), ('ar', 'arabic'::regconfig)) AS l (code, cfg)
      LEFT JOIN products_locales pl ON pl._parent_id = p.id AND pl._locale::text = l.code
      LEFT JOIN products_locales en ON en._parent_id = p.id AND en._locale::text = 'en'
      LEFT JOIN brands b ON b.id = p.brand_id
      LEFT JOIN LATERAL (
        SELECT string_agg(coalesce(cl.title, ce.title), ' ') AS titles
        FROM products_rels r
        LEFT JOIN categories_locales cl ON cl._parent_id = r.categories_id AND cl._locale::text = l.code
        LEFT JOIN categories_locales ce ON ce._parent_id = r.categories_id AND ce._locale::text = 'en'
        WHERE r.parent_id = p.id AND r.path = 'categories' AND r.categories_id IS NOT NULL
      ) cats ON true
      WHERE p.id = pid;
    END $$;

    CREATE OR REPLACE FUNCTION alpha_product_search_trigger() RETURNS trigger
    LANGUAGE plpgsql AS $$
    DECLARE
      row_data record := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    BEGIN
      IF TG_TABLE_NAME = 'products' THEN
        PERFORM alpha_refresh_product_search(row_data.id);
      ELSIF TG_TABLE_NAME = 'products_locales' THEN
        PERFORM alpha_refresh_product_search(row_data._parent_id);
      ELSIF TG_TABLE_NAME = 'products_rels' THEN
        PERFORM alpha_refresh_product_search(row_data.parent_id);
      ELSIF TG_TABLE_NAME = 'brands' THEN
        PERFORM alpha_refresh_product_search(p.id) FROM products p WHERE p.brand_id = row_data.id;
      ELSIF TG_TABLE_NAME = 'categories_locales' THEN
        PERFORM alpha_refresh_product_search(r.parent_id)
          FROM (SELECT DISTINCT parent_id FROM products_rels WHERE categories_id = row_data._parent_id) r;
      END IF;
      RETURN NULL;
    END $$;

    CREATE TRIGGER product_search_products AFTER INSERT OR UPDATE ON products
      FOR EACH ROW EXECUTE FUNCTION alpha_product_search_trigger();
    CREATE TRIGGER product_search_products_locales AFTER INSERT OR UPDATE OR DELETE ON products_locales
      FOR EACH ROW EXECUTE FUNCTION alpha_product_search_trigger();
    CREATE TRIGGER product_search_products_rels AFTER INSERT OR UPDATE OR DELETE ON products_rels
      FOR EACH ROW EXECUTE FUNCTION alpha_product_search_trigger();
    CREATE TRIGGER product_search_brands AFTER UPDATE OF name ON brands
      FOR EACH ROW EXECUTE FUNCTION alpha_product_search_trigger();
    CREATE TRIGGER product_search_categories_locales AFTER INSERT OR UPDATE OR DELETE ON categories_locales
      FOR EACH ROW EXECUTE FUNCTION alpha_product_search_trigger();

    SELECT alpha_refresh_product_search(id) FROM products;
  `)
}

export async function down({ db }: Pick<MigrateDownArgs, 'db'>): Promise<void> {
  await db.execute(sql`
    DROP TRIGGER IF EXISTS product_search_categories_locales ON categories_locales;
    DROP TRIGGER IF EXISTS product_search_brands ON brands;
    DROP TRIGGER IF EXISTS product_search_products_rels ON products_rels;
    DROP TRIGGER IF EXISTS product_search_products_locales ON products_locales;
    DROP TRIGGER IF EXISTS product_search_products ON products;
    DROP FUNCTION IF EXISTS alpha_product_search_trigger();
    DROP FUNCTION IF EXISTS alpha_refresh_product_search(integer);
    DROP TABLE IF EXISTS product_search;
    DROP FUNCTION IF EXISTS alpha_search_normalise(text);
  `)
}
