import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { loadEnv } from '@alpha/config/env'
import {
  Home,
  LEDGER_QUEUE,
  catalogCollections,
  contentCollections,
  customerCollections,
  LegacyRedirects,
  Markets,
  inventoryCollections,
  purchasingCollections,
  salesCollections,
  releaseExpiredReservationsTask,
  expireCheckoutsTask,
  sendNotificationTask,
  NOTIFICATIONS_AUTORUN,
} from '@alpha/payload'
import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { migrations } from './migrations'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const env = loadEnv()

/** SMTP from `SMTP_URL` (Mailpit locally); without it Payload writes emails to the log. */
function smtpOptions(url: string) {
  const parsed = new URL(url)
  return {
    host: parsed.hostname,
    port: Number(parsed.port || (parsed.protocol === 'smtps:' ? 465 : 587)),
    secure: parsed.protocol === 'smtps:',
    ...(parsed.username
      ? {
          auth: {
            user: decodeURIComponent(parsed.username),
            pass: decodeURIComponent(parsed.password),
          },
        }
      : {}),
  }
}

export default buildConfig({
  serverURL: env.NEXT_PUBLIC_SERVER_URL,
  secret: env.PAYLOAD_SECRET,
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
  localization: {
    locales: [
      { code: 'en', label: 'English' },
      { code: 'ar', label: 'العربية', rtl: true },
    ],
    defaultLocale: 'en',
    fallback: true,
  },
  collections: [
    ...catalogCollections,
    ...contentCollections,
    Media,
    ...inventoryCollections,
    ...purchasingCollections,
    ...salesCollections,
    ...customerCollections,
    LegacyRedirects,
    Users,
  ],
  globals: [Home, Markets],
  jobs: {
    tasks: [releaseExpiredReservationsTask, expireCheckoutsTask, sendNotificationTask],
    // Runs inside the app process (Payload starts crons on the first admin or API request).
    // The scheduled task queues itself each minute; this cron works the ledger queue.
    autoRun: [{ cron: '* * * * *', queue: LEDGER_QUEUE }, NOTIFICATIONS_AUTORUN],
    jobsCollectionOverrides: ({ defaultJobsCollection }) => ({
      ...defaultJobsCollection,
      admin: { ...defaultJobsCollection.admin, group: 'System', hidden: false },
    }),
  },
  ...(env.SMTP_URL
    ? {
        email: nodemailerAdapter({
          defaultFromAddress: env.EMAIL_FROM_ADDRESS,
          defaultFromName: env.EMAIL_FROM_NAME,
          transportOptions: smtpOptions(env.SMTP_URL),
          // Startup must not depend on the mail server; failed sends retry in the job.
          skipVerify: true,
        }),
      }
    : {}),
  editor: lexicalEditor(),
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: postgresAdapter({
    pool: { connectionString: env.DATABASE_URL },
    prodMigrations: migrations,
  }),
  plugins: [
    s3Storage({
      collections: { media: true },
      bucket: env.S3_BUCKET,
      config: {
        endpoint: env.S3_ENDPOINT,
        region: env.S3_REGION,
        forcePathStyle: env.S3_FORCE_PATH_STYLE,
        credentials: {
          accessKeyId: env.S3_ACCESS_KEY_ID,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        },
      },
    }),
  ],
  sharp: (await import('sharp')).default,
})
