import { DOC_TYPES, RESERVATION_DOC_TYPES, RESERVATION_STATUSES, STOCK_STATES } from '@alpha/core'

const options = <T extends string>(values: readonly T[]) =>
  values.map((value) => ({ label: value, value }))

export const STATE_OPTIONS = options(STOCK_STATES)
export const DOC_TYPE_OPTIONS = options(DOC_TYPES)
export const RESERVATION_DOC_TYPE_OPTIONS = options(RESERVATION_DOC_TYPES)
export const RESERVATION_STATUS_OPTIONS = options(RESERVATION_STATUSES)
export const LOCATION_TYPES = ['warehouse', 'showroom', 'demo', 'consignment', 'service'] as const
export const LOCATION_TYPE_OPTIONS = options(LOCATION_TYPES)
