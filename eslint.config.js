import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules', 'dist', 'build', 'coverage', 'docs', 'fixtures'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
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
