import * as migration_20261014_023806_initial_schema from './20261014_023806_initial_schema';
import * as migration_20261014_023807_pgvector from './20261014_023807_pgvector';
import * as migration_20261014_093836_markets_and_legacy_redirects from './20261014_093836_markets_and_legacy_redirects';
import * as migration_20261014_181649_inventory_ledger from './20261014_181649_inventory_ledger';
import * as migration_20261014_181650_ledger_constraints from './20261014_181650_ledger_constraints';
import * as migration_20261014_185458_purchasing from './20261014_185458_purchasing';
import * as migration_20261014_185459_purchasing_constraints from './20261014_185459_purchasing_constraints';
import * as migration_20261014_193323_catalog from './20261014_193323_catalog';
import * as migration_20261014_193324_catalog_constraints from './20261014_193324_catalog_constraints';
import * as migration_20261015_032501_category_facet_specs from './20261015_032501_category_facet_specs';
import * as migration_20261015_041146_brand_agreements from './20261015_041146_brand_agreements';
import * as migration_20261015_073407_checkout from './20261015_073407_checkout';
import * as migration_20261015_073408_checkout_constraints from './20261015_073408_checkout_constraints';
import * as migration_20261015_073659_jobs_expire_checkouts from './20261015_073659_jobs_expire_checkouts';
import * as migration_20261015_092240_fulfilment from './20261015_092240_fulfilment';
import * as migration_20261015_092241_fulfilment_constraints from './20261015_092241_fulfilment_constraints';
import * as migration_20261015_095446_pages from './20261015_095446_pages';
import * as migration_20261015_095447_product_search from './20261015_095447_product_search';
import * as migration_20261015_102240_customers from './20261015_102240_customers';
import * as migration_20261015_105401_trade from './20261015_105401_trade';
import * as migration_20261015_111227_company_user_locale from './20261015_111227_company_user_locale';
import * as migration_20261015_123205_trade_orders from './20261015_123205_trade_orders';
import * as migration_20261015_123206_trade_orders_constraints from './20261015_123206_trade_orders_constraints';
import * as migration_20261015_134318_quotes from './20261015_134318_quotes';
import * as migration_20261015_134319_quotes_constraints from './20261015_134319_quotes_constraints';

export const migrations = [
  {
    up: migration_20261014_023806_initial_schema.up,
    down: migration_20261014_023806_initial_schema.down,
    name: '20261014_023806_initial_schema',
  },
  {
    up: migration_20261014_023807_pgvector.up,
    down: migration_20261014_023807_pgvector.down,
    name: '20261014_023807_pgvector',
  },
  {
    up: migration_20261014_093836_markets_and_legacy_redirects.up,
    down: migration_20261014_093836_markets_and_legacy_redirects.down,
    name: '20261014_093836_markets_and_legacy_redirects',
  },
  {
    up: migration_20261014_181649_inventory_ledger.up,
    down: migration_20261014_181649_inventory_ledger.down,
    name: '20261014_181649_inventory_ledger',
  },
  {
    up: migration_20261014_181650_ledger_constraints.up,
    down: migration_20261014_181650_ledger_constraints.down,
    name: '20261014_181650_ledger_constraints',
  },
  {
    up: migration_20261014_185458_purchasing.up,
    down: migration_20261014_185458_purchasing.down,
    name: '20261014_185458_purchasing',
  },
  {
    up: migration_20261014_185459_purchasing_constraints.up,
    down: migration_20261014_185459_purchasing_constraints.down,
    name: '20261014_185459_purchasing_constraints',
  },
  {
    up: migration_20261014_193323_catalog.up,
    down: migration_20261014_193323_catalog.down,
    name: '20261014_193323_catalog',
  },
  {
    up: migration_20261014_193324_catalog_constraints.up,
    down: migration_20261014_193324_catalog_constraints.down,
    name: '20261014_193324_catalog_constraints',
  },
  {
    up: migration_20261015_032501_category_facet_specs.up,
    down: migration_20261015_032501_category_facet_specs.down,
    name: '20261015_032501_category_facet_specs',
  },
  {
    up: migration_20261015_041146_brand_agreements.up,
    down: migration_20261015_041146_brand_agreements.down,
    name: '20261015_041146_brand_agreements',
  },
  {
    up: migration_20261015_073407_checkout.up,
    down: migration_20261015_073407_checkout.down,
    name: '20261015_073407_checkout',
  },
  {
    up: migration_20261015_073408_checkout_constraints.up,
    down: migration_20261015_073408_checkout_constraints.down,
    name: '20261015_073408_checkout_constraints',
  },
  {
    up: migration_20261015_073659_jobs_expire_checkouts.up,
    down: migration_20261015_073659_jobs_expire_checkouts.down,
    name: '20261015_073659_jobs_expire_checkouts',
  },
  {
    up: migration_20261015_092240_fulfilment.up,
    down: migration_20261015_092240_fulfilment.down,
    name: '20261015_092240_fulfilment',
  },
  {
    up: migration_20261015_092241_fulfilment_constraints.up,
    down: migration_20261015_092241_fulfilment_constraints.down,
    name: '20261015_092241_fulfilment_constraints',
  },
  {
    up: migration_20261015_095446_pages.up,
    down: migration_20261015_095446_pages.down,
    name: '20261015_095446_pages',
  },
  {
    up: migration_20261015_095447_product_search.up,
    down: migration_20261015_095447_product_search.down,
    name: '20261015_095447_product_search',
  },
  {
    up: migration_20261015_102240_customers.up,
    down: migration_20261015_102240_customers.down,
    name: '20261015_102240_customers',
  },
  {
    up: migration_20261015_105401_trade.up,
    down: migration_20261015_105401_trade.down,
    name: '20261015_105401_trade',
  },
  {
    up: migration_20261015_111227_company_user_locale.up,
    down: migration_20261015_111227_company_user_locale.down,
    name: '20261015_111227_company_user_locale',
  },
  {
    up: migration_20261015_123205_trade_orders.up,
    down: migration_20261015_123205_trade_orders.down,
    name: '20261015_123205_trade_orders',
  },
  {
    up: migration_20261015_123206_trade_orders_constraints.up,
    down: migration_20261015_123206_trade_orders_constraints.down,
    name: '20261015_123206_trade_orders_constraints',
  },
  {
    up: migration_20261015_134318_quotes.up,
    down: migration_20261015_134318_quotes.down,
    name: '20261015_134318_quotes',
  },
  {
    up: migration_20261015_134319_quotes_constraints.up,
    down: migration_20261015_134319_quotes_constraints.down,
    name: '20261015_134319_quotes_constraints',
  },
]
