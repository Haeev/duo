// Configuration du générateur des sauvegardes de référence (jamais lancé par `pnpm test`):
//   pnpm exec vitest run --config tests/donnees/sauvegardes/generer.config.ts
// Elle ne part pas de la configuration commune: `mergeConfig` ajouterait tous les tests du jeu.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('../../..', import.meta.url)),
  test: {
    include: ['tests/donnees/sauvegardes/generer.ts'],
    environment: 'node',
    retry: 0,
    testTimeout: 600_000,
  },
});
