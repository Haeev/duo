// Robots d'été (tour 8): parties de six semaines, hors de la boucle rapide de `pnpm test`.
//   pnpm test:ete
// Une graine par test, plusieurs fichiers en parallèle; relevés dans `test-results/robots-ete/`.
// Elle ne part pas de la configuration commune: `mergeConfig` ajouterait tous les tests du jeu.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/ete/**/*.ete.ts'],
    environment: 'node',
    retry: 0,
    testTimeout: 900_000,
  },
});
