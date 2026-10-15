import { describe, expect, it } from 'vitest'
import { ADDRESS_SCHEME_FIELDS, isAddressScheme, validateDetails } from './address'

const contact = { name: '  Layla  Haddad ', email: 'Layla@Example.com ', phone: '+971 50 123 4567' }

describe('validateDetails', () => {
  it('cleans contact details and an Emirates (Makani) address', () => {
    const result = validateDetails('ae-makani', {
      ...contact,
      city: 'Dubai',
      area: 'Al Quoz',
      street: 'Street 6A',
      building: 'Warehouse 12',
      makani: '12345 67890',
    })
    expect(result).toEqual({
      ok: true,
      details: {
        contact: { name: 'Layla Haddad', email: 'layla@example.com', phone: '+971501234567' },
        address: {
          city: 'Dubai',
          area: 'Al Quoz',
          street: 'Street 6A',
          building: 'Warehouse 12',
          makani: '1234567890',
        },
      },
    })
  })

  it('reports missing, invalid and too-long fields by name', () => {
    const result = validateDetails('sa-national-address', {
      name: 'x'.repeat(121),
      email: 'not-an-email',
      phone: '12',
      city: 'Riyadh',
      district: 'Al Olaya',
      street: 'King Fahd Road',
      buildingNumber: '12',
      postalCode: '',
      shortAddress: 'rrrd 2929',
    })
    expect(result).toEqual({
      ok: false,
      errors: {
        name: 'too-long',
        email: 'invalid',
        phone: 'invalid',
        buildingNumber: 'invalid',
        postalCode: 'required',
      },
    })
  })

  it('requires the contact fields and skips optional address fields left empty', () => {
    const result = validateDetails('bh-block', {
      city: 'Manama',
      block: '338',
      road: '3803',
      building: '9',
    })
    expect(result).toEqual({
      ok: false,
      errors: { name: 'required', email: 'required', phone: 'required' },
    })
    expect(
      validateDetails('om-way', {
        ...contact,
        city: 'Muscat',
        area: 'Qurum',
        way: '2731',
        building: '14',
        notes: '',
      }),
    ).toMatchObject({ ok: true, details: { address: { way: '2731' } } })
  })

  it('ignores fields that are not in the scheme and non-string input', () => {
    const result = validateDetails('qa-zone', {
      ...contact,
      city: 'Doha',
      zone: '66',
      streetNumber: '850',
      buildingNo: 12,
      makani: '1234567890',
    })
    expect(result).toEqual({ ok: false, errors: { buildingNo: 'required' } })
  })

  it('knows every scheme and only those', () => {
    expect(Object.keys(ADDRESS_SCHEME_FIELDS)).toHaveLength(6)
    expect(isAddressScheme('kw-paci')).toBe(true)
    expect(isAddressScheme('uk-postcode')).toBe(false)
    expect(isAddressScheme('constructor')).toBe(false)
    for (const fields of Object.values(ADDRESS_SCHEME_FIELDS)) {
      expect(fields.some((f) => f.name === 'notes' && !f.required)).toBe(true)
    }
  })
})
