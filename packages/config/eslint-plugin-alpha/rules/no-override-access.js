/**
 * `overrideAccess: true` is allowed only inside packages/payload/src/system/, and there only with
 * a comment directly above it explaining why (CLAUDE.md). Everywhere else, Local API calls made
 * on behalf of a user must pass `overrideAccess: false` so collection and field access apply.
 */
const SYSTEM_DIR = /packages[\\/]payload[\\/](src[\\/])?system[\\/]/

function isOverrideTrue(node) {
  const key = node.key?.name ?? node.key?.value
  return key === 'overrideAccess' && node.value?.type === 'Literal' && node.value.value === true
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow overrideAccess: true outside packages/payload/src/system, and require a reason there.',
    },
    messages: {
      override:
        'alpha/no-override-access: overrideAccess: true is only allowed inside packages/payload/src/system/. Pass overrideAccess: false and let access rules apply.',
      reason:
        'alpha/no-override-access: overrideAccess: true needs a comment directly above it explaining why access rules are bypassed.',
    },
    schema: [],
  },
  create(context) {
    const file = context.filename ?? context.getFilename()
    const inSystem = SYSTEM_DIR.test(file)
    const sourceCode = context.sourceCode ?? context.getSourceCode()
    return {
      Property(node) {
        if (!isOverrideTrue(node)) return
        if (!inSystem) {
          context.report({ node, messageId: 'override' })
          return
        }
        if (sourceCode.getCommentsBefore(node).length === 0) {
          context.report({ node, messageId: 'reason' })
        }
      },
    }
  },
}
