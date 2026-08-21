// TabCraft — ESLint flat config.
//
// Replaces .eslintrc.json: ESLint 10 removed eslintrc support entirely, so the
// `env`/`extends`/`ignorePatterns` keys no longer exist. Their flat equivalents:
//   env             -> languageOptions.globals (from the `globals` package)
//   extends         -> spreading the shared config objects directly
//   ignorePatterns  -> a leading { ignores: [...] } block
//
// The rule set is carried over unchanged, so this is a mechanical migration and
// not a change in what is enforced.

import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Must stay in its own object to apply globally rather than to one file set.
  { ignores: ['node_modules/**', 'build/**', 'dist/**', '.plasmo/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      // `browser` covers the side panel, `webextensions` the chrome.* surface
      // the service worker and components rely on.
      globals: { ...globals.browser, ...globals.webextensions },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  }
);
