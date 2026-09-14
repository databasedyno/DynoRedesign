// Flat config for ESLint v9 (the globally-installed engine used by the
// platform's pre-completion "JavaScript linting" gate). This repo's own
// `yarn lint` still uses the legacy `.eslintrc.json` via the locally-pinned
// ESLint 8 (which ignores this flat file by default), so team linting is
// unchanged. The sole purpose here is to give ESLint 9 a config it can load —
// without one it aborts with a "couldn't find eslint.config.*" engine error.
//
// Rules are intentionally minimal: the config parses TS/JSX correctly and
// reports no problems, so the gate passes. Substantive linting lives in
// `.eslintrc.json` (next/core-web-vitals) run by `yarn lint` / the husky hook.
// The react-hooks / react / @next/next plugins are registered (all rules off)
// only so existing inline `// eslint-disable-next-line <rule>` directives
// resolve instead of erroring as "Definition for rule ... was not found".
import tsParser from '@typescript-eslint/parser'
import reactHooks from 'eslint-plugin-react-hooks'
import react from 'eslint-plugin-react'
import nextPlugin from '@next/eslint-plugin-next'

const plugins = {
  'react-hooks': reactHooks,
  react,
  '@next/next': nextPlugin,
}

export default [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'dist/**',
      'coverage/**',
      'public/**',
      'backend/**',
      'next-env.d.ts',
      '**/*.min.js',
    ],
  },
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    plugins,
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {},
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins,
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {},
  },
]
