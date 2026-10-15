import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import type { Payload } from 'payload'

/**
 * Short-lived secrets at rest (docs/tasks/0012): AES-256-GCM under a key derived from the
 * instance secret. Used for the sign-in link while it waits in the notification outbox; the
 * ciphertext is cleared once the email is sent.
 */
const key = (payload: Pick<Payload, 'secret'>) =>
  createHash('sha256').update(`secret-box\n${payload.secret}`).digest()

export function seal(payload: Pick<Payload, 'secret'>, plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(payload), iv)
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString('base64url')).join('.')
}

/** The plain text, or null when the box was tampered with or sealed under another secret. */
export function open(payload: Pick<Payload, 'secret'>, sealed: string): string | null {
  const [iv, tag, body] = sealed.split('.').map((p) => Buffer.from(p, 'base64url'))
  if (!iv || !tag || !body) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(payload), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}
