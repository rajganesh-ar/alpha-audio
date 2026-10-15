export { Customers } from './Customers'
export { CustomerSessions } from './CustomerSessions'
export { SignInLinks } from './SignInLinks'
export { customerSessionStrategy } from './strategy'

import { CustomerSessions } from './CustomerSessions'
import { Customers } from './Customers'
import { SignInLinks } from './SignInLinks'

/** Every customer collection, in admin order. */
export const customerCollections = [Customers, CustomerSessions, SignInLinks]
