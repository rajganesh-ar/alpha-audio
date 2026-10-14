export { Suppliers } from './Suppliers'
export { PurchaseOrders, guardPurchaseOrderChanges } from './PurchaseOrders'
export { GoodsReceipts, freezePostedReceipts } from './GoodsReceipts'

import { GoodsReceipts } from './GoodsReceipts'
import { PurchaseOrders } from './PurchaseOrders'
import { Suppliers } from './Suppliers'

/** Every purchasing collection, in admin order. */
export const purchasingCollections = [Suppliers, PurchaseOrders, GoodsReceipts]
