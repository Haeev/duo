// Tests longs (parties de plus d'une journée de jeu, bancs de mesure): hors de `pnpm test`.
//   pnpm test:longues
// Elle ne part pas de la configuration commune: `mergeConfig` ajouterait tous les tests du jeu.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/longues/**/*.longue.ts'],
    environment: 'node',
    retry: 0,
    testTimeout: 900_000,
    passWithNoTests: true,
  },
});
