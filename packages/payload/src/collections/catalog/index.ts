export { Brands } from './Brands'
export { Categories } from './Categories'
export { Products, PRODUCT_LIFECYCLES } from './Products'
export { SLUG_PATTERN } from './fields'
export { FACET_SPECS, type FacetSpec } from './specs'

import { Brands } from './Brands'
import { Categories } from './Categories'
import { Products } from './Products'

/** Every catalogue collection, in admin order. */
export const catalogCollections = [Products, Brands, Categories]
