import { APIError, type CollectionBeforeChangeHook, type CollectionConfig } from 'payload'
import {
  AGREEMENT_ROLES,
  COMPLIANCE_FLAGS,
  LEAD_ROUTINGS,
  agreementProblems,
  type Agreement,
  type ComplianceFlag,
} from '@alpha/core'
import { isStaff, nobody } from '../../access'
import { revalidateStorefront } from '../../hooks/revalidateStorefront'
import { MARKET_CODES } from '../../markets/codes'

const revalidate = revalidateStorefront('catalog')

interface AgreementData {
  id?: number | string
  brand?: number | { id: number } | null
  market?: string | null
  role?: Agreement['role'] | null
  exclusive?: boolean | null
  validFrom?: string | null
  validTo?: string | null
  leadRouting?: Agreement['leadRouting'] | null
  complianceFlags?: ComplianceFlag[] | null
}

const idOf = (brand: AgreementData['brand']) =>
  typeof brand === 'object' && brand !== null ? brand.id : brand

/** The core model of an agreement document (dates as Date; missing values as defaults). */
export function toAgreement(doc: AgreementData): Agreement {
  return {
    id: doc.id,
    brand: idOf(doc.brand) ?? '',
    market: doc.market ?? '',
    role: doc.role ?? 'none',
    exclusive: doc.exclusive ?? false,
    validFrom: doc.validFrom ? new Date(doc.validFrom) : null,
    validTo: doc.validTo ? new Date(doc.validTo) : null,
    leadRouting: doc.leadRouting ?? 'alpha',
    complianceFlags: doc.complianceFlags ?? [],
  }
}

/** One agreement per brand and market at any instant; an agreement ends after it starts. */
export const validateAgreementWindow: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
}) => {
  const candidate = toAgreement({
    ...(originalDoc as AgreementData | undefined),
    ...(data as AgreementData),
  })
  const { docs } = await req.payload.find({
    collection: 'brand-agreements',
    where: {
      and: [{ brand: { equals: candidate.brand } }, { market: { equals: candidate.market } }],
    },
    limit: 200,
    depth: 0,
    pagination: false,
    overrideAccess: false,
    req,
  })
  const problems = agreementProblems(
    candidate,
    docs.map((d) => toAgreement(d as AgreementData)),
  )
  if (problems.includes('ends-before-start'))
    throw new APIError('Valid to must be after valid from.', 400)
  if (problems.includes('overlaps')) {
    throw new APIError(
      'Another agreement for this brand and market covers part of this period. End it first (set its valid to).',
      400,
    )
  }
  return data
}

/**
 * Which brands Alpha may sell in which market, and how (spec: Catalog → BrandAgreements).
 * Commercial data: staff only. The storefront reads a projection through the system reader
 * (`system/marketRights.ts`). Agreements are ended with `validTo`, never deleted.
 */
export const BrandAgreements: CollectionConfig = {
  slug: 'brand-agreements',
  labels: { singular: 'Brand agreement', plural: 'Brand agreements' },
  admin: {
    group: 'Catalogue',
    defaultColumns: ['brand', 'market', 'role', 'exclusive', 'validFrom', 'validTo'],
  },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: nobody },
  hooks: {
    beforeChange: [validateAgreementWindow],
    afterChange: [revalidate.afterChange],
    afterDelete: [revalidate.afterDelete],
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'brand',
          type: 'relationship',
          relationTo: 'brands',
          required: true,
          index: true,
          admin: { width: '40%' },
        },
        {
          name: 'market',
          type: 'select',
          required: true,
          options: MARKET_CODES.map((c) => ({ label: c.toUpperCase(), value: c })),
          admin: { width: '20%' },
        },
        {
          name: 'role',
          type: 'select',
          required: true,
          defaultValue: 'distributor',
          options: AGREEMENT_ROLES.map((r) => ({ label: r, value: r })),
          admin: { width: '20%' },
        },
        { name: 'exclusive', type: 'checkbox', defaultValue: false, admin: { width: '20%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'validFrom',
          type: 'date',
          admin: { width: '33%', description: 'Inclusive. Empty: already in force.' },
        },
        {
          name: 'validTo',
          type: 'date',
          admin: {
            width: '33%',
            description: 'Exclusive. Empty: open-ended. Set it to end the agreement.',
          },
        },
        {
          name: 'leadRouting',
          type: 'select',
          required: true,
          defaultValue: 'alpha',
          options: LEAD_ROUTINGS.map((r) => ({ label: r, value: r })),
          admin: { width: '34%', description: 'Who receives leads for this brand in this market.' },
        },
      ],
    },
    {
      name: 'complianceFlags',
      type: 'select',
      hasMany: true,
      options: COMPLIANCE_FLAGS.map((f) => ({ label: f, value: f })),
      admin: {
        description: 'origin-restriction and registration-pending hide the brand in this market.',
      },
    },
    { name: 'notes', type: 'textarea' },
  ],
}
