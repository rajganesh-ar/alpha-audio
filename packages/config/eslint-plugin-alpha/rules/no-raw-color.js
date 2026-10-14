/**
 * Fails on hex, rgb() and hsl() colour literals in component source. Colours come from
 * tokens.css custom properties via the Tailwind theme (bg-lacquer, text-vu-amber …).
 */
const RAW = /#(?:[0-9a-fA-F]{3}){1,2}\b|\b(?:rgba?|hsla?)\(/

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow raw colour literals; use design tokens.' },
    messages: {
      raw: 'alpha/no-raw-color: raw colour "{{value}}". Use a token from @alpha/ui/tokens.css via the Tailwind theme.',
    },
    schema: [],
  },
  create(context) {
    function check(node, value) {
      if (typeof value !== 'string') return
      const m = value.match(RAW)
      if (m) context.report({ node, messageId: 'raw', data: { value: m[0] } })
    }
    return {
      Literal(node) {
        check(node, node.value)
      },
      TemplateElement(node) {
        check(node, node.value.cooked)
      },
    }
  },
}
