export { Warehouses } from './Warehouses'
export { Locations } from './Locations'
export { StockMovements } from './StockMovements'
export { StockLevels } from './StockLevels'
export { SerialNumbers } from './SerialNumbers'
export { Reservations } from './Reservations'

import { Locations } from './Locations'
import { Reservations } from './Reservations'
import { SerialNumbers } from './SerialNumbers'
import { StockLevels } from './StockLevels'
import { StockMovements } from './StockMovements'
import { Warehouses } from './Warehouses'

/** Every inventory collection, in admin order. */
export const inventoryCollections = [
  Warehouses,
  Locations,
  StockMovements,
  StockLevels,
  SerialNumbers,
  Reservations,
]
