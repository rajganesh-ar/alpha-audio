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
];
