import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import { loadEnv } from '@alpha/config/env'
import { alphaConfig } from '@alpha/payload'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const env = loadEnv()

/**
 * The dealer board's Payload: the shared configuration (ADR 0014) with its own session cookie,
 * no admin routes, no migrations (the web app runs them) and no job workers (jobs it queues run
 * in the web app). Media URLs point at the web app, which serves media.
 */
export default buildConfig(
  alphaConfig({
    env,
    serverURL: env.NEXT_PUBLIC_SERVER_URL,
    csrf: [env.PARTNERS_SERVER_URL],
    cookiePrefix: 'alpha-partners',
    runJobs: false,
    typescriptOutputFile: path.resolve(dirname, 'payload-types.ts'),
  }),
)
