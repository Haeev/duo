import { createVitestConfig } from '@duo/config/vitest';

// Les démos entières jouées par les robots durent 10 à 25 s seules, bien plus quand la machine
// est partagée (fichiers en parallèle, autres membres au travail): 5 minutes de marge par test.
export default createVitestConfig({ test: { testTimeout: 300_000 } });
