import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/build',
      'coverage',
      'docs',
      'fixtures',
      // librerie Adobe/Bolt incluse così come sono
      'apps/illustrator/src/js/lib/**',
      'apps/illustrator/src/jsx/lib/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.svelte'] },
    },
  },
  {
    files: ['packages/ui/**', 'apps/**'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    // ExtendScript (ES3 dopo Babel): `var` voluto, come nel codice che gira nell'host
    files: ['apps/illustrator/src/jsx/**/*.ts'],
    rules: { 'no-var': 'off' },
  },
  {
    // Regola d'oro §5.5: core non importa da ui, dalle app né dal DOM.
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['@compasso/ui', '@compasso/ui/*', '**/apps/**', '**/packages/ui/**'] },
      ],
      'no-restricted-globals': ['error', 'document', 'window', 'localStorage', 'DOMParser'],
    },
  },
);
