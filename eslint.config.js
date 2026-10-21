import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: ['.wxt/**', 'node_modules/**', '.output/**', 'dist/**', 'eslint.config.js', 'vitest.config.ts', 'wxt.config.ts', 'playwright.config.ts'],
  },
  js.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-console': 'error',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    // The logger is the one module that owns the console sink; tests may spy
    // on or silence console output while asserting the injected sink instead.
    files: ['utils/logger.ts', 'tests/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'off',
    },
  },
);