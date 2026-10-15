export { Brands } from './Brands'
export { BrandAgreements, toAgreement, validateAgreementWindow } from './BrandAgreements'
export { Categories } from './Categories'
export { Products, PRODUCT_LIFECYCLES } from './Products'
export { SLUG_PATTERN } from './fields'
export { FACET_SPECS, type FacetSpec } from './specs'

import { BrandAgreements } from './BrandAgreements'
import { Brands } from './Brands'
import { Categories } from './Categories'
import { Products } from './Products'

/** Every catalogue collection, in admin order. */
export const catalogCollections = [Products, Brands, Categories, BrandAgreements]
