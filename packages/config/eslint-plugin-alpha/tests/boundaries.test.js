import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'
import base, { pure } from '../../eslint.config.js'

/**
 * Regression guard for the import boundaries in CLAUDE.md. These lint real source text through
 * the shared configs exactly as a package would load them, so a config change that silently
 * stops applying a rule (as a repo-root `files` glob once did) fails here.
 */
async function messages(config, code, filePath = 'src/probe.ts') {
  const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config })
  const [result] = await eslint.lintText(code, { filePath })
  return result.messages.filter((m) => m.ruleId === 'no-restricted-imports').map((m) => m.message)
}

const pureConfig = [...base, ...pure]

describe('import boundaries', () => {
  it('blocks any package from importing an app', async () => {
    const found = await messages(base, "import { x } from '@alpha/web'\nexport const y = x\n")
    expect(found).toHaveLength(1)
    expect(found[0]).toContain('Packages must never import apps')
  })

  it.each([
    'react',
    'react-dom',
    'next',
    'next/navigation',
    '@payloadcms/ui',
    '@payloadcms/next/views',
  ])('blocks a pure package from importing %s', async (specifier) => {
    const found = await messages(
      pureConfig,
      `import * as m from '${specifier}'\nexport const y = m\n`,
    )
    expect(found).toHaveLength(1)
    expect(found[0]).toContain('Pure packages must not import React, Next.js or Payload UI')
  })

  it('still blocks app imports inside a pure package', async () => {
    const found = await messages(pureConfig, "import { x } from '@alpha/web'\nexport const y = x\n")
    expect(found).toHaveLength(1)
    expect(found[0]).toContain('Packages must never import apps')
  })

  it('lets a non-pure package (payload) import React', async () => {
    const found = await messages(
      base,
      "import { useState } from 'react'\nexport const y = useState\n",
    )
    expect(found).toHaveLength(0)
  })

  it('lets a pure package import other packages and node built-ins', async () => {
    const found = await messages(
      pureConfig,
      "import { z } from 'zod'\nimport { createHash } from 'node:crypto'\nexport const y = [z, createHash]\n",
    )
    expect(found).toHaveLength(0)
  })
})
