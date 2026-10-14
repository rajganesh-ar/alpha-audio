/**
 * Fails on Tailwind utilities that encode a physical direction (ml-, mr-, pl-, pr-, left-,
 * right-, text-left, text-right, border-l, border-r, rounded-l, rounded-r …).
 * Use the logical forms: ms-, me-, ps-, pe-, start-, end-, text-start, text-end, border-s,
 * border-e, rounded-s, rounded-e. Logical utilities mirror automatically in RTL.
 */
const PHYSICAL =
  /(^|[\s:!])-?(ml|mr|pl|pr|left|right|inset-x-l|inset-x-r|scroll-ml|scroll-mr|scroll-pl|scroll-pr)-[\w./[\]-]+|(^|[\s:!])(text-left|text-right|border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br|border-l-\w+|border-r-\w+)(?=$|\s)/

const LOGICAL = {
  ml: 'ms',
  mr: 'me',
  pl: 'ps',
  pr: 'pe',
  left: 'start',
  right: 'end',
  'text-left': 'text-start',
  'text-right': 'text-end',
  'border-l': 'border-s',
  'border-r': 'border-e',
  'rounded-l': 'rounded-s',
  'rounded-r': 'rounded-e',
}

function suggestion(match) {
  const token = match.trim().replace(/^!/, '')
  const base = token.replace(/^-/, '').split('-').slice(0, 2).join('-')
  const head = token.replace(/^-/, '').split('-')[0]
  return LOGICAL[base] ?? LOGICAL[head] ?? 'the logical equivalent'
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow physical-direction Tailwind utilities; use logical properties so RTL mirrors.',
    },
    messages: {
      physical:
        'alpha/no-physical-direction: "{{token}}" is a physical-direction utility. Use "{{logical}}-…" so the layout mirrors in RTL.',
    },
    schema: [],
  },
  create(context) {
    function check(node, value) {
      if (typeof value !== 'string') return
      for (const cls of value.split(/\s+/)) {
        if (!cls) continue
        if (PHYSICAL.test(cls)) {
          context.report({
            node,
            messageId: 'physical',
            data: { token: cls, logical: suggestion(cls) },
          })
        }
      }
    }
    return {
      JSXAttribute(node) {
        if (!['className', 'class'].includes(node.name?.name)) return
        const v = node.value
        if (!v) return
        if (v.type === 'Literal') check(v, v.value)
        if (v.type === 'JSXExpressionContainer') {
          const e = v.expression
          if (e.type === 'Literal') check(e, e.value)
          if (e.type === 'TemplateLiteral') for (const q of e.quasis) check(q, q.value.cooked)
        }
      },
      Literal(node) {
        // strings passed to clsx / cn / cva helpers
        const p = node.parent
        if (p?.type === 'CallExpression' && typeof node.value === 'string') check(node, node.value)
      },
      TemplateElement(node) {
        const call = node.parent?.parent
        if (call?.type === 'CallExpression') check(node, node.value.cooked)
      },
    }
  },
}
