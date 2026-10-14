import base, { pure } from '@alpha/config/eslint'

// Pure package: no React, Next.js or Payload UI (CLAUDE.md, import boundaries).
export default [...base, ...pure]
