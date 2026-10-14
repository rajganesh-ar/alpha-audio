import * as migration_20261014_023806_initial_schema from './20261014_023806_initial_schema';
import * as migration_20261014_023807_pgvector from './20261014_023807_pgvector';

export const migrations = [
  {
    up: migration_20261014_023806_initial_schema.up,
    down: migration_20261014_023806_initial_schema.down,
    name: '20261014_023806_initial_schema',
  },
  {
    up: migration_20261014_023807_pgvector.up,
    down: migration_20261014_023807_pgvector.down,
    name: '20261014_023807_pgvector'
  },
];
