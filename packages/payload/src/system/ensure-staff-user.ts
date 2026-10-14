import type { Payload } from 'payload'

export const STAFF_COLLECTION_SLUG = 'users'

export interface StaffCredentials {
  email: string
  password: string
}

/**
 * Bootstraps a staff account (the first admin of a fresh environment, or a test fixture):
 * returns the existing user with that email, or creates it. Everything after this runs as
 * that user with normal access rules.
 */
export async function ensureStaffUser(payload: Payload, { email, password }: StaffCredentials) {
  const { docs } = await payload.find({
    collection: STAFF_COLLECTION_SLUG,
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    // System bootstrap: there may be no staff account yet to read the users collection as.
    overrideAccess: true,
  })
  if (docs[0]) return docs[0]
  return payload.create({
    collection: STAFF_COLLECTION_SLUG,
    data: { email, password },
    // System bootstrap: creating the first staff account cannot be done by a staff account.
    overrideAccess: true,
  })
}
