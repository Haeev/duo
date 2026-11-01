// Robot longue vie (tour 8, section 6): sept parties de 84 jours, hors de la boucle rapide.
//   pnpm test:longue-vie
// Une partie par fichier, fichiers en parallèle; rapport dans `test-results/longue-vie.md` et
// `test-results/longue-vie.json` (écrits par `tests/longue-vie/rapport.ts` à la fin de la suite).
// Elle ne part pas de la configuration commune: `mergeConfig` ajouterait tous les tests du jeu.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/longue-vie/**/*.longue.ts'],
    globalSetup: ['tests/longue-vie/rapport.ts'],
    environment: 'node',
    retry: 0,
    testTimeout: 3_600_000,
    // Une partie par processus: quatre à la fois, comme sur quatre fils en intégration continue.
    maxWorkers: 4,
  },
});
