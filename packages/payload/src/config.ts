import type { Config } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import type { Env } from '@alpha/config/env'
import { catalogCollections } from './collections/catalog'
import { contentCollections } from './collections/content'
import { customerCollections } from './collections/customers'
import { inventoryCollections } from './collections/inventory'
import { LegacyRedirects } from './collections/LegacyRedirects'
import { purchasingCollections } from './collections/purchasing'
import { salesCollections } from './collections/sales'
import { Media, Users } from './collections/staff'
import { tradeCollections } from './collections/trade'
import { Home } from './globals/Home'
import { Markets } from './globals/Markets'
import { PricingSettings } from './globals/PricingSettings'
import { expireCheckoutsTask } from './jobs/expireCheckouts'
import { LEDGER_QUEUE, releaseExpiredReservationsTask } from './jobs/releaseExpiredReservations'
import { NOTIFICATIONS_AUTORUN, sendNotificationTask } from './jobs/sendNotification'
import { LEADS_AUTORUN, rerouteExpiredLeadsTask, routeLeadTask } from './jobs/leads'

/**
 * The one Payload configuration of the platform, shared by every app that talks to the database
 * (ADR 0014): the storefront and admin (apps/web) and the dealer board (apps/partners). Each
 * app passes what differs: its admin (web only), the migrations it runs at start (web only),
 * whether it works the job queues (web only), its auth cookie prefix and where its generated
 * types go. Collections, access, hooks and jobs are identical everywhere.
 */
export interface AlphaConfigOptions {
  env: Env
  /** Where Payload builds media and admin URLs: always the web app, which serves media. */
  serverURL?: string | undefined
  /** Other origins allowed to send cookie-authenticated requests (the partners app). */
  csrf?: readonly string[] | undefined
  admin?: Config['admin'] | undefined
  /** Auth cookie name prefix; each app has its own so sessions never cross between them. */
  cookiePrefix?: string | undefined
  /** Migrations applied at start-up in production (the web app only). */
  migrations?: NonNullable<Parameters<typeof postgresAdapter>[0]>['prodMigrations'] | undefined
  /** Work the job queues in this process (the web app only, so jobs run once). */
  runJobs: boolean
  typescriptOutputFile: string
  sharp?: Config['sharp'] | undefined
}

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

export function alphaConfig(options: AlphaConfigOptions): Config {
  const { env } = options
  const serverURL = options.serverURL ?? env.NEXT_PUBLIC_SERVER_URL
  return {
    serverURL,
    secret: env.PAYLOAD_SECRET,
    // Read by system code that links across apps (lead emails link to the dealer board).
    custom: { partnersServerURL: env.PARTNERS_SERVER_URL },
    cookiePrefix: options.cookiePrefix ?? 'payload',
    csrf: [...new Set([serverURL, ...(options.csrf ?? [])])],
    admin: options.admin ?? { user: Users.slug },
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
      ...tradeCollections,
      LegacyRedirects,
      Users,
    ],
    globals: [Home, Markets, PricingSettings],
    jobs: {
      tasks: [
        releaseExpiredReservationsTask,
        expireCheckoutsTask,
        sendNotificationTask,
        routeLeadTask,
        rerouteExpiredLeadsTask,
      ],
      // The web app works the queues (Payload starts the crons on the first request); other
      // apps only queue jobs, so every job runs once.
      autoRun: options.runJobs
        ? [{ cron: '* * * * *', queue: LEDGER_QUEUE }, NOTIFICATIONS_AUTORUN, LEADS_AUTORUN]
        : [],
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
    typescript: { outputFile: options.typescriptOutputFile },
    db: postgresAdapter({
      pool: { connectionString: env.DATABASE_URL },
      ...(options.migrations ? { prodMigrations: options.migrations } : {}),
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
    ...(options.sharp ? { sharp: options.sharp } : {}),
  }
}
