/**
 * Checkout contact and address capture per market scheme (spec: GCC market layer → address
 * scheme). The Markets record names the scheme; this module says which fields it has and how
 * each is checked, so the checkout page renders fields from data and never branches on a
 * market code. Labels live in the i18n dictionary under `checkout.address.<field>`.
 */

export const ADDRESS_FIELDS = [
  'city',
  'area',
  'street',
  'building',
  'makani',
  'district',
  'buildingNumber',
  'additionalNumber',
  'postalCode',
  'shortAddress',
  'zone',
  'streetNumber',
  'buildingNo',
  'governorate',
  'block',
  'paci',
  'road',
  'way',
  'notes',
] as const
export type AddressField = (typeof ADDRESS_FIELDS)[number]

export interface AddressFieldSpec {
  name: AddressField
  required: boolean
  /** Anchored pattern the trimmed value must match (after removing spaces when `compact`). */
  pattern?: RegExp | undefined
  /** Remove spaces before checking and storing (codes typed in groups, e.g. Makani). */
  compact?: boolean | undefined
  inputMode?: 'numeric' | 'text' | undefined
  autoComplete?: string | undefined
  maxLength: number
}

const text = (name: AddressField, required = true, autoComplete?: string): AddressFieldSpec => ({
  name,
  required,
  maxLength: 120,
  ...(autoComplete ? { autoComplete } : {}),
})
const digits = (
  name: AddressField,
  count: string,
  required = true,
  autoComplete?: string,
): AddressFieldSpec => ({
  name,
  required,
  pattern: new RegExp(`^\\d{${count}}$`),
  compact: true,
  inputMode: 'numeric',
  maxLength: 16,
  ...(autoComplete ? { autoComplete } : {}),
})
const notes: AddressFieldSpec = { name: 'notes', required: false, maxLength: 300 }

/** Fields per scheme, in the order a local shopper expects them. */
export const ADDRESS_SCHEME_FIELDS = {
  'ae-makani': [
    text('city', true, 'address-level1'),
    text('area', true, 'address-level2'),
    text('street', true, 'address-line1'),
    text('building', true, 'address-line2'),
    digits('makani', '10', false),
    notes,
  ],
  'sa-national-address': [
    text('city', true, 'address-level1'),
    text('district', true, 'address-level2'),
    text('street', true, 'address-line1'),
    digits('buildingNumber', '4'),
    digits('additionalNumber', '4', false),
    digits('postalCode', '5', true, 'postal-code'),
    {
      name: 'shortAddress',
      required: false,
      pattern: /^[A-Z]{4}\d{4}$/,
      compact: true,
      maxLength: 12,
    },
    notes,
  ],
  'qa-zone': [
    text('city', true, 'address-level1'),
    digits('zone', '1,2'),
    digits('streetNumber', '1,4'),
    digits('buildingNo', '1,4'),
    notes,
  ],
  'kw-paci': [
    text('governorate', true, 'address-level1'),
    text('area', true, 'address-level2'),
    digits('block', '1,3'),
    text('street', true, 'address-line1'),
    text('building', true, 'address-line2'),
    digits('paci', '8', false),
    notes,
  ],
  'bh-block': [
    text('city', true, 'address-level1'),
    digits('block', '3,4'),
    digits('road', '1,4'),
    text('building', true, 'address-line2'),
    notes,
  ],
  'om-way': [
    text('city', true, 'address-level1'),
    text('area', true, 'address-level2'),
    digits('way', '1,5'),
    text('building', true, 'address-line2'),
    notes,
  ],
} as const satisfies Record<string, readonly AddressFieldSpec[]>
export type AddressSchemeCode = keyof typeof ADDRESS_SCHEME_FIELDS

export const CONTACT_FIELDS = ['name', 'email', 'phone'] as const
export type ContactField = (typeof CONTACT_FIELDS)[number]

export type FieldProblem = 'required' | 'invalid' | 'too-long'

export interface CheckoutDetails {
  contact: Record<ContactField, string>
  address: Partial<Record<AddressField, string>>
}

export type DetailsResult =
  | { ok: true; details: CheckoutDetails }
  | { ok: false; errors: Partial<Record<ContactField | AddressField, FieldProblem>> }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** International or local digits, optional leading +, spaces and dashes allowed while typing. */
const PHONE = /^\+?\d{7,15}$/

const clean = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''

/** Checks contact and address input against the market's scheme; returns the cleaned values. */
export function validateDetails(
  scheme: AddressSchemeCode,
  input: Readonly<Record<string, unknown>>,
): DetailsResult {
  const errors: Partial<Record<ContactField | AddressField, FieldProblem>> = {}

  const name = clean(input['name'])
  const email = clean(input['email']).toLowerCase()
  const phone = clean(input['phone']).replace(/[\s-]/g, '')
  if (!name) errors.name = 'required'
  else if (name.length > 120) errors.name = 'too-long'
  if (!email) errors.email = 'required'
  else if (email.length > 254 || !EMAIL.test(email)) errors.email = 'invalid'
  if (!phone) errors.phone = 'required'
  else if (!PHONE.test(phone)) errors.phone = 'invalid'

  const address: Partial<Record<AddressField, string>> = {}
  for (const field of ADDRESS_SCHEME_FIELDS[scheme] as readonly AddressFieldSpec[]) {
    let value = clean(input[field.name])
    if (field.compact) value = value.replace(/\s/g, '').toUpperCase()
    if (!value) {
      if (field.required) errors[field.name] = 'required'
      continue
    }
    if (value.length > field.maxLength) errors[field.name] = 'too-long'
    else if (field.pattern && !field.pattern.test(value)) errors[field.name] = 'invalid'
    else address[field.name] = value
  }

  if (Object.keys(errors).length) return { ok: false, errors }
  return { ok: true, details: { contact: { name, email, phone }, address } }
}

export function isAddressScheme(value: string): value is AddressSchemeCode {
  return Object.hasOwn(ADDRESS_SCHEME_FIELDS, value)
}
