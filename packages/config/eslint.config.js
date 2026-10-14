import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import importPlugin from 'eslint-plugin-import'
import prettier from 'eslint-config-prettier'
import alpha from './eslint-plugin-alpha/index.js'

const APPS_PATTERN = {
  group: ['@alpha/web', '@alpha/partners', 'apps/*', '**/apps/**'],
  message: 'Packages must never import apps (import boundary).',
}

const UI_RUNTIME_PATTERN = {
  group: [
    'react',
    'react-dom',
    'react/*',
    'next',
    'next/*',
    '@payloadcms/ui',
    '@payloadcms/next',
    '@payloadcms/ui/*',
    '@payloadcms/next/*',
  ],
  message: 'Pure packages must not import React, Next.js or Payload UI (import boundary).',
}

/**
 * Extra rules for pure packages (core, acoustics, llm). Spread it after the default config:
 *   export default [...base, ...pure]
 * It carries no `files` glob on purpose: flat-config globs resolve against the directory of
 * the config file that loads them, so a repo-root glob like `packages/core/**` never matches
 * when ESLint runs inside the package. Opting in per package is explicit and cannot miss.
 */
export const pure = [
  {
    rules: {
      'no-restricted-imports': ['error', { patterns: [APPS_PATTERN, UI_RUNTIME_PATTERN] }],
    },
  },
]

/**
 * Shared flat config. Apps and packages re-export this; the import-boundary rule keeps
 * packages from importing apps. Pure packages also spread `pure` to keep React/Next out.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/coverage/**',
      '**/*.d.ts',
      '**/payload-types.ts',
      '**/migrations/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    plugins: { 'jsx-a11y': jsxA11y, import: importPlugin, alpha },
    rules: {
      ...jsxA11y.configs.recommended.rules,
      'alpha/no-physical-direction': 'error',
      'alpha/no-raw-color': 'error',
      'alpha/no-override-access': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description', 'ts-ignore': true },
      ],
      'no-restricted-imports': ['error', { patterns: [APPS_PATTERN] }],
    },
  },
  {
    files: ['**/eslint-plugin-alpha/tests/**'],
    rules: {
      'alpha/no-raw-color': 'off',
      'alpha/no-physical-direction': 'off',
      'alpha/no-override-access': 'off',
    },
  },
  prettier,
)
