import { createVitestConfig } from '@duo/config/vitest';

// Suite rapide (`pnpm test`): un test court par nouveauté. Garde-temps: un test de plus de 20 s
// échoue et part dans `tests/longues/` (`pnpm test:longues`, à la demande seulement).
export default createVitestConfig({
  test: {
    testTimeout: 20_000,
    exclude: ['tests/longues/**', 'tests/e2e/**', 'node_modules/**', 'dist/**'],
  },
});
