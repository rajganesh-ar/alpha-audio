import type { Payload } from 'payload'

/**
 * Boots the real Payload config against `databaseUrl` and applies the committed migrations,
 * exactly as production does (no dev schema push). Variables the config validates but these
 * tests never use (S3, public origin) get fixed test values.
 */
export async function bootPayload(databaseUrl: string): Promise<Payload> {
  process.env['DATABASE_URL'] = databaseUrl
  process.env['PAYLOAD_SECRET'] ??= 'integration-test-secret-0000000000000000000000000000'
  process.env['NEXT_PUBLIC_SERVER_URL'] ??= 'http://localhost:3000'
  process.env['S3_ENDPOINT'] ??= 'http://localhost:9000'
  process.env['S3_BUCKET'] ??= 'alpha-test'
  process.env['S3_ACCESS_KEY_ID'] ??= 'test'
  process.env['S3_SECRET_ACCESS_KEY'] ??= 'test'
  // Skips Payload's dev-mode schema push, so the schema comes only from the migrations.
  process.env['PAYLOAD_MIGRATING'] = 'true'

  const [{ getPayload }, { default: config }, { migrations }] = await Promise.all([
    import('payload'),
    import('../../../src/payload.config'),
    import('../../../src/migrations'),
  ])
  const payload = await getPayload({ config })
  // reason: the generated migrations index types `up`/`down` with the adapter's own arg types,
  // which are narrower than the base adapter's `Migration`; at runtime they are the same.
  type Migrations = NonNullable<NonNullable<Parameters<typeof payload.db.migrate>[0]>['migrations']>
  await payload.db.migrate({ migrations: migrations as unknown as Migrations })
  return payload
}
