import { createEslintConfig } from '@duo/config/eslint';

// Trois programmes TypeScript (principal, interface, preloads) aux bibliothèques
// différentes: on les nomme au lieu de laisser le service de projets chercher
// un tsconfig.json unique.
export default [
  ...createEslintConfig({
    tsconfigRootDir: import.meta.dirname,
    environment: 'both',
    ignores: ['tests/fixtures/**'],
  }),
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['**/*.config.ts'],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: [
          './tsconfig.node.json',
          './tsconfig.web.json',
          './tsconfig.preload.json',
          './tsconfig.e2e.json',
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
