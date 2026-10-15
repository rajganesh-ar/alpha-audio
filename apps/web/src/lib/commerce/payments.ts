import { createHmac } from 'node:crypto'
import { loadEnv } from '@alpha/config/env'
import { SandboxPaymentProvider } from '@alpha/payload'

/**
 * The payment provider for this deployment (docs/tasks/0009). `PAYMENT_PROVIDER` picks it; only
 * the sandbox exists until the card gateway is chosen. The sandbox is refused in production
 * unless `PAYMENT_SANDBOX_ALLOWED=true` (staging), so a live site cannot take test payments:
 * checkout then reports that online payment is unavailable.
 */

type Source = Record<string, string | undefined>

/** The sandbox signing secret: its own variable, or derived from PAYLOAD_SECRET. */
export function sandboxSecret(source: Source = process.env): string {
  const env = loadEnv(source)
  return (
    env.PAYMENT_SANDBOX_SECRET ??
    createHmac('sha256', env.PAYLOAD_SECRET).update('payment-sandbox').digest('hex')
  )
}

/** Null when payments are refused in this environment. */
export function paymentProvider(
  pageFor: (intentId: string, query: string) => string = () => '',
  source: Source = process.env,
): SandboxPaymentProvider | null {
  const env = loadEnv(source)
  if (env.NODE_ENV === 'production' && !env.PAYMENT_SANDBOX_ALLOWED) return null
  return new SandboxPaymentProvider(sandboxSecret(source), pageFor)
}
