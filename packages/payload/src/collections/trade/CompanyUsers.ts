import type { CollectionConfig } from 'payload'
import { isStaff, nobody, staffField, staffOrColleagues } from '../../access'
import { wholeNumber } from '../purchasing/fields'

export const COMPANY_ROLES = ['owner', 'purchaser', 'viewer', 'installer'] as const
export type CompanyRole = (typeof COMPANY_ROLES)[number]

/**
 * People who sign in to the dealer board for a company (docs/tasks/0013; spec: company users
 * sign in with email and password, session 24 h). Their company comes from this record, never
 * from a request. Staff create and maintain them; colleagues see each other.
 */
export const CompanyUsers: CollectionConfig = {
  slug: 'company-users',
  labels: { singular: 'Company user', plural: 'Company users' },
  auth: { tokenExpiration: 24 * 60 * 60, maxLoginAttempts: 5, lockTime: 15 * 60 * 1000 },
  admin: {
    group: 'Trade',
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'company', 'role'],
  },
  access: { read: staffOrColleagues, create: isStaff, update: isStaff, delete: nobody },
  fields: [
    { name: 'name', type: 'text' },
    {
      type: 'row',
      fields: [
        {
          name: 'company',
          type: 'relationship',
          relationTo: 'companies',
          required: true,
          index: true,
          access: { update: staffField },
          admin: { width: '40%' },
        },
        {
          name: 'role',
          type: 'select',
          required: true,
          defaultValue: 'viewer',
          options: COMPANY_ROLES.map((r) => ({ label: r, value: r })),
          access: { update: staffField },
          admin: { width: '30%' },
        },
        {
          name: 'approvalThreshold',
          type: 'number',
          validate: wholeNumber('Approval threshold', 0),
          access: { update: staffField },
          admin: { width: '30%', description: 'Orders above this need an owner’s approval.' },
        },
      ],
    },
  ],
}
