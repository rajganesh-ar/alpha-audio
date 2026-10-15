/**
 * Product spec fields a category may offer as listing filters (docs/tasks/0007). Discrete
 * values only: channels, impedance and sensitivity are listed as the values products have.
 */
export const FACET_SPECS = [
  'channels',
  'impedanceOhm',
  'minImpedanceOhm',
  'sensitivityDb',
  'powerW',
] as const
export type FacetSpec = (typeof FACET_SPECS)[number]
