import { createVitestConfig } from '@duo/config/vitest';
import { LONG_TESTS } from './vitest.longues';

// Les démos entières jouées par les robots durent 10 à 25 s seules, bien plus quand la machine
// est partagée (fichiers en parallèle, autres membres au travail): 5 minutes de marge par test.
// Les longues parties de robots sont à part (`pnpm test:longues`).
export default createVitestConfig({ test: { testTimeout: 300_000, exclude: [...LONG_TESTS] } });
