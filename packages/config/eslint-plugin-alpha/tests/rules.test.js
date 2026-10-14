import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import noPhysicalDirection from '../rules/no-physical-direction.js'
import noRawColor from '../rules/no-raw-color.js'
import noOverrideAccess from '../rules/no-override-access.js'

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

describe('alpha/no-physical-direction', () => {
  it('passes logical and fails physical utilities', () => {
    tester.run('no-physical-direction', noPhysicalDirection, {
      valid: [
        { code: '<div className="ms-4 pe-2 text-start border-s rounded-s" />' },
        { code: 'cn("ps-4", "md:me-8")' },
        { code: '<div className="translate-x-1 flex-row" />' },
      ],
      invalid: [
        { code: '<div className="ml-4" />', errors: [{ messageId: 'physical' }] },
        {
          code: '<div className="md:pr-2 text-left" />',
          errors: [{ messageId: 'physical' }, { messageId: 'physical' }],
        },
        { code: 'cn("mr-2")', errors: [{ messageId: 'physical' }] },
        { code: '<div className={`left-0 ${x}`} />', errors: [{ messageId: 'physical' }] },
      ],
    })
  })
})

describe('alpha/no-raw-color', () => {
  it('passes tokens and fails hex/rgb/hsl', () => {
    tester.run('no-raw-color', noRawColor, {
      valid: [
        { code: 'const c = "bg-lacquer text-vu-amber"' },
        { code: 'const v = "var(--color-bronze)"' },
      ],
      invalid: [
        { code: 'const c = "#E3A13B"', errors: [{ messageId: 'raw' }] },
        { code: 'const c = `rgb(20, 27, 36)`', errors: [{ messageId: 'raw' }] },
        { code: 'const c = "hsla(1,2%,3%,.5)"', errors: [{ messageId: 'raw' }] },
      ],
    })
  })
})

describe('alpha/no-override-access', () => {
  it('allows overrideAccess: true only in packages/payload/src/system, with a reason', () => {
    tester.run('no-override-access', noOverrideAccess, {
      valid: [
        {
          code: 'payload.find({ collection: "x", overrideAccess: false })',
          filename: '/r/apps/web/a.ts',
        },
        {
          code: 'payload.find({\n  // Seed runs with no signed-in user.\n  overrideAccess: true,\n})',
          filename: '/r/packages/payload/src/system/seed.ts',
        },
        {
          code: 'payload.find({\n  /* System job: no user. */ overrideAccess: true,\n})',
          filename: '/r/packages/payload/system/job.ts',
        },
      ],
      invalid: [
        {
          code: 'payload.find({ overrideAccess: true })',
          filename: '/r/apps/web/a.ts',
          errors: [{ messageId: 'override' }],
        },
        {
          code: 'payload.find({ overrideAccess: true })',
          filename: '/r/packages/payload/src/collections/x.ts',
          errors: [{ messageId: 'override' }],
        },
        {
          code: 'payload.find({ overrideAccess: true })',
          filename: '/r/packages/payload-system/src/seed.ts',
          errors: [{ messageId: 'override' }],
        },
        {
          code: 'payload.find({ collection: "x", overrideAccess: true })',
          filename: '/r/packages/payload/src/system/seed.ts',
          errors: [{ messageId: 'reason' }],
        },
      ],
    })
  })
})
