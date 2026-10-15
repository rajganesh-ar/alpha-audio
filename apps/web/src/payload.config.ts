import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import { loadEnv } from '@alpha/config/env'
import { Users, alphaConfig } from '@alpha/payload'
import { migrations } from './migrations'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const env = loadEnv()

/**
 * The storefront, admin and ops app: the shared configuration (ADR 0014) with the admin, the
 * migrations run at start-up, and the job queues.
 */
export default buildConfig(
  alphaConfig({
    env,
    admin: {
      user: Users.slug,
      importMap: { baseDir: path.resolve(dirname) },
      components: {
        views: {
          ledgerExplorer: {
            Component: '@alpha/payload/admin/LedgerExplorer#LedgerExplorer',
            path: '/ledger',
            exact: true,
          },
        },
        afterNavLinks: ['@alpha/payload/admin/LedgerNavLink#LedgerNavLink'],
      },
    },
    migrations,
    runJobs: true,
    typescriptOutputFile: path.resolve(dirname, 'payload-types.ts'),
    sharp: (await import('sharp')).default,
  }),
)
