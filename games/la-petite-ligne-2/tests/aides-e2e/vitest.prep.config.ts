import { join } from 'node:path';
import { createVitestConfig } from '@duo/config/vitest';

// Fabrication des sauvegardes de départ de la recette à deux (hors de `pnpm test`).
export default createVitestConfig({
  root: join(import.meta.dirname, '../..'),
  test: { include: ['tests/aides-e2e/*.prep.ts'], testTimeout: 60_000 },
});
