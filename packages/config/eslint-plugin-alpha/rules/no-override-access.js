/**
 * Fails on `overrideAccess: true` outside packages/payload/system/**. Local API calls made on
 * behalf of a user must pass `overrideAccess: false` so field-level and collection access apply.
 */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow overrideAccess: true outside packages/payload/system.' },
    messages: {
      override:
        'alpha/no-override-access: overrideAccess: true is only allowed inside packages/payload/system/. Pass overrideAccess: false and let access rules apply.',
    },
    schema: [],
  },
  create(context) {
    const file = context.filename ?? context.getFilename()
    if (/packages[\\/]payload[\\/]system[\\/]/.test(file)) return {}
    return {
      Property(node) {
        const key = node.key?.name ?? node.key?.value
        if (
          key === 'overrideAccess' &&
          node.value?.type === 'Literal' &&
          node.value.value === true
        ) {
          context.report({ node, messageId: 'override' })
        }
      },
    }
  },
}
