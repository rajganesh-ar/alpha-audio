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
