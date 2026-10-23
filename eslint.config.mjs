import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

// Ported from weflyhome.com, where the module was written.
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    settings: { next: { rootDir: 'dev/' } },
    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
    },
  },
  {
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    rules: {
      // A spread before `key` makes the compiler fall back to createElement, and
      // React then reports a missing key on the element's children.
      'react/jsx-key': ['error', { checkKeyMustBeforeSpread: true }],
    },
  },
  {
    ignores: [
      'dist/',
      'coverage/',
      'dev/.next/',
      'dev/next-env.d.ts',
      'dev/payload-types.ts',
      'dev/app/(payload)/',
      'examples/*/app/(payload)/',
    ],
  },
]

export default eslintConfig
