import noPhysicalDirection from './rules/no-physical-direction.js'
import noRawColor from './rules/no-raw-color.js'
import noOverrideAccess from './rules/no-override-access.js'

const plugin = {
  meta: { name: 'eslint-plugin-alpha', version: '0.0.0' },
  rules: {
    'no-physical-direction': noPhysicalDirection,
    'no-raw-color': noRawColor,
    'no-override-access': noOverrideAccess,
  },
}

export default plugin
