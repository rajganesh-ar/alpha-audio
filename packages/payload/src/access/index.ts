import type { Access, FieldAccess } from 'payload'

/**
 * Named access functions (CLAUDE.md: never inline `() => true` on a commercial or inventory
 * collection). Role-based rules replace `isStaff` when the access-control task adds roles.
 */

/** Anyone, signed in or not. For data that is public by nature: market config, redirect map. */
export const publicRead: Access = () => true

/**
 * A signed-in staff user. Today every account in the `users` collection is staff; customers and
 * company users will live in their own collections, so checking the collection keeps them out.
 */
export const isStaff: Access = ({ req }) => req.user?.collection === 'users'

/** No one, including admins. For insert-only data such as StockMovements. */
export const nobody: Access = () => false

/**
 * Who may read cost fields (unit cost, landed cost, margin). Staff only until the access-control
 * task introduces finance and manager roles; customers and company users never see cost.
 */
export const canReadCost: FieldAccess = ({ req }) => req.user?.collection === 'users'

/** Field-level: no one types this value; a system service writes it in its own transaction. */
export const systemWritten: FieldAccess = () => false

/**
 * Catalogue and content: staff read everything (drafts included); everyone else reads only
 * published documents. Which market a product is sold in is the storefront's filter, not
 * access: a published product is public in the markets it is published in.
 */
export const publishedOrStaff: Access = ({ req }) =>
  req.user?.collection === 'users' ? true : { _status: { equals: 'published' } }

/**
 * Who may publish catalogue and content. Every staff user until the access-control task adds
 * the `publisher` role (CLAUDE.md); kept as its own function so that task changes one line.
 */
export const canPublish: Access = ({ req }) => req.user?.collection === 'users'

/** Create and update for catalogue and content: staff, and publishing needs `canPublish`. */
export const canEditCatalog: Access = (args) => {
  if (args.req.user?.collection !== 'users') return false
  const status = (args.data as { _status?: unknown } | undefined)?._status
  return status === 'published' ? canPublish(args) : true
}

/** Field-level: staff only (hidden values such as idempotency keys and token hashes). */
export const staffField: FieldAccess = ({ req }) => req.user?.collection === 'users'

/** Field-level: no one, through any API (secrets that only system code reads). */
export const noOneReads: FieldAccess = () => false
