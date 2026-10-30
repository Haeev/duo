// @ts-check
// Configuration Vitest partagée (ADR 0013, niveau U).
import { defineConfig, mergeConfig } from 'vitest/config';

/**
 * Tests unitaires: `*.test.ts` (et variantes JavaScript). Les tests Playwright
 * s'appellent `*.spec.ts` et vivent dans `tests/e2e/`: Vitest ne les prend pas.
 */
const baseConfig = defineConfig({
  test: {
    include: ['**/*.test.{ts,tsx,mts,cts,js,mjs,cjs}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/assets-src/**',
      '**/e2e/**',
    ],
    environment: 'node',
    // Un test qui échoue n'est jamais relancé automatiquement (ADR 0013, point 6).
    retry: 0,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});

/**
 * Construit la configuration Vitest d'un paquet à partir de la base commune.
 * @param {import('vitest/config').ViteUserConfig} [overrides] réglages propres au paquet
 * @returns {import('vitest/config').ViteUserConfig}
 */
export function createVitestConfig(overrides = {}) {
  return mergeConfig(baseConfig, overrides);
}
