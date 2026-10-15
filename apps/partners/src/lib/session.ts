import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Payload } from 'payload'
import { partnerAccount, type PartnerAccount } from '@alpha/payload'
import { payloadClient } from './payload'

export interface Partner {
  payload: Payload
  /** The signed-in company user, as Payload resolved it from the session cookie. */
  user: unknown
  account: PartnerAccount
}

/**
 * The signed-in company user for this request, or null. Read from the Payload session (the
 * `alpha-partners-token` cookie), never from a parameter (CLAUDE.md rule 3). Cached per request.
 */
export const currentPartner = cache(async (): Promise<Partner | null> => {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: await headers() })
  const account = user ? await partnerAccount(payload, user) : null
  return account ? { payload, user, account } : null
})

/** The partner, or a redirect to sign in. */
export async function requirePartner(): Promise<Partner> {
  const partner = await currentPartner()
  if (!partner) redirect('/login')
  return partner
}
