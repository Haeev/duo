// @ts-check
// Configuration ESLint partagée (ADR 0002, point 5): lint typé et strict.
import eslintComments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Fichiers de test (Vitest et Playwright). La console y est permise par ESLint; `console.log` et `debugger` restent refusés par `pnpm verifier`. */
export const testFiles = [
  '**/*.test.{ts,tsx,mts,cts,js,mjs,cjs}',
  '**/*.spec.{ts,tsx,mts,cts,js,mjs,cjs}',
  '**/tests/**',
];

/** Fichiers de configuration des outils, souvent hors du tsconfig du paquet: lint sans les règles typées. */
const toolConfigFiles = ['**/*.config.{js,mjs,cjs,ts,mts,cts}'];

/** Dossiers jamais analysés: produits de construction, sources des assets (scripts de génération, Blender, Python). */
const ignoredDirectories = [
  '**/node_modules/**',
  '**/dist/**',
  '**/out/**',
  '**/build/**',
  '**/coverage/**',
  '**/test-results/**',
  '**/playwright-report/**',
  '**/assets-src/**',
];

/**
 * Construit la configuration ESLint d'un paquet.
 * @param {{ tsconfigRootDir: string, environment?: 'node' | 'browser' | 'both', ignores?: string[] }} options
 *   `tsconfigRootDir`: dossier du paquet (`import.meta.dirname` dans son `eslint.config.js`).
 *   `environment`: variables globales des fichiers JavaScript (le TypeScript s'appuie sur son tsconfig).
 *   `ignores`: motifs à ignorer en plus.
 * @returns {import('eslint').Linter.Config[]}
 */
export function createEslintConfig({ tsconfigRootDir, environment = 'node', ignores = [] }) {
  const environmentGlobals =
    environment === 'node'
      ? globals.node
      : environment === 'browser'
        ? globals.browser
        : { ...globals.node, ...globals.browser };

  return defineConfig(
    globalIgnores([...ignoredDirectories, ...ignores]),
    {
      linterOptions: {
        reportUnusedDisableDirectives: 'error',
        reportUnusedInlineConfigs: 'error',
      },
    },
    js.configs.recommended,
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    eslintComments.recommended,
    {
      languageOptions: {
        ecmaVersion: 2024,
        sourceType: 'module',
        globals: environmentGlobals,
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-non-null-assertion': 'error',
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/explicit-module-boundary-types': 'error',
        '@typescript-eslint/switch-exhaustiveness-check': [
          'error',
          { considerDefaultExhaustiveForUnions: false, requireDefaultForNonUnion: true },
        ],
        '@typescript-eslint/consistent-type-imports': 'error',
        '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
        // Une dérogation dit pourquoi: `// eslint-disable-next-line règle -- raison`.
        '@eslint-community/eslint-comments/require-description': 'error',
        '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
        'no-console': 'error',
        'no-debugger': 'error',
        eqeqeq: ['error', 'always'],
      },
    },
    {
      files: testFiles,
      rules: {
        'no-console': 'off',
      },
    },
    {
      files: toolConfigFiles,
      extends: [tseslint.configs.disableTypeChecked],
      rules: {
        '@typescript-eslint/explicit-module-boundary-types': 'off',
      },
    },
  );
}
