import { expect, type APIRequestContext } from '@playwright/test'

/**
 * Reads emails from Mailpit (the local and CI mail catcher on SMTP_URL). The app sends the
 * sign-in link from its job queue straight after the request, so it arrives within seconds.
 */
const MAILPIT = process.env['MAILPIT_URL'] ?? 'http://127.0.0.1:8025'

export async function latestEmailTo(
  request: APIRequestContext,
  to: string,
): Promise<{ subject: string; text: string }> {
  let found: { ID: string } | undefined
  await expect
    .poll(
      async () => {
        const res = await request.get(
          `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`,
        )
        const body = (await res.json()) as { messages?: Array<{ ID: string }> }
        found = body.messages?.[0]
        return Boolean(found)
      },
      { timeout: 30_000, intervals: [500, 1000, 2000] },
    )
    .toBe(true)
  const message = (await (
    await request.get(`${MAILPIT}/api/v1/message/${found?.ID ?? ''}`)
  ).json()) as {
    Subject: string
    Text: string
  }
  return { subject: message.Subject, text: message.Text }
}
