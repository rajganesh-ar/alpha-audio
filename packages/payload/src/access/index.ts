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

/** A signed-in storefront customer (docs/tasks/0012; session from the `alpha_session` cookie). */
export const isCustomer = (user: { collection?: string } | null | undefined): boolean =>
  user?.collection === 'customers'

/** Customers: staff read everyone (support); a customer reads only their own record. */
export const staffOrSelf: Access = ({ req }) => {
  if (req.user?.collection === 'users') return true
  if (isCustomer(req.user)) return { id: { equals: req.user?.id } }
  return false
}

/**
 * Orders: staff read all; a signed-in customer reads the orders placed with their verified email
 * address (they proved it by signing in with a link sent to it). Everyone else: nothing.
 */
export const staffOrOwnOrders: Access = ({ req }) => {
  if (req.user?.collection === 'users') return true
  const email = (req.user as { email?: unknown } | null)?.email
  if (isCustomer(req.user) && typeof email === 'string' && email)
    return { 'contact.email': { equals: email } }
  return false
}

/** Shipments: staff read all; a customer reads the shipments of their own orders. */
export const staffOrOwnShipments: Access = ({ req }) => {
  if (req.user?.collection === 'users') return true
  const email = (req.user as { email?: unknown } | null)?.email
  if (isCustomer(req.user) && typeof email === 'string' && email)
    return { 'order.contact.email': { equals: email } }
  return false
}

/** A signed-in company user (dealer board; docs/tasks/0013). */
export const isCompanyUser = (user: { collection?: string } | null | undefined): boolean =>
  user?.collection === 'company-users'

/** The company id of a signed-in company user (relationship populated or not). */
export function companyOf(user: unknown): number | null {
  const company = (user as { collection?: string; company?: unknown } | null)?.company
  if (!isCompanyUser(user as { collection?: string })) return null
  if (typeof company === 'number') return company
  if (company && typeof company === 'object' && 'id' in company)
    return Number((company as { id: unknown }).id)
  return null
}

const companyRole = (user: unknown): string | null =>
  isCompanyUser(user as { collection?: string })
    ? String((user as { role?: unknown }).role ?? '')
    : null

/** Companies: staff read all; a company user reads only their own company (spec: company scope). */
export const staffOrOwnCompany: Access = ({ req }) => {
  if (req.user?.collection === 'users') return true
  const company = companyOf(req.user)
  return company !== null ? { id: { equals: company } } : false
}

/** Company users: staff read all; a company user reads the users of their own company. */
export const staffOrColleagues: Access = ({ req }) => {
  if (req.user?.collection === 'users') return true
  const company = companyOf(req.user)
  return company !== null ? { company: { equals: company } } : false
}

/**
 * Credit, terms and order settings of a company: staff, and the company's own owner or
 * purchaser. Viewers and installers see the catalogue, not the account's commercial terms.
 */
export const canReadCompanyTerms: FieldAccess = ({ req, doc }) => {
  if (req.user?.collection === 'users') return true
  const company = companyOf(req.user)
  const role = companyRole(req.user)
  return (
    company !== null &&
    Number((doc as { id?: unknown } | undefined)?.id) === company &&
    (role === 'owner' || role === 'purchaser')
  )
}
