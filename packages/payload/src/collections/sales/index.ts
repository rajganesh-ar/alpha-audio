export { Carts } from './Carts'
export { Orders } from './Orders'
export { WebhookEvents } from './WebhookEvents'

import { Carts } from './Carts'
import { Orders } from './Orders'
import { WebhookEvents } from './WebhookEvents'

/** Every sales collection, in admin order. */
export const salesCollections = [Orders, Carts, WebhookEvents]
