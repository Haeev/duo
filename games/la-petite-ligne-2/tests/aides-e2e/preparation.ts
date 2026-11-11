// `globalSetup` de Playwright: fabrique les sauvegardes de départ avant les parcours.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

export default function setup(): void {
  const result = spawnSync(
    'pnpm',
    // Le filtre est nécessaire: `mergeConfig` ajoute `*.prep.ts` aux motifs de la base
    // (`*.test.ts`) au lieu de les remplacer, et toute la suite rapide passait avant chaque recette.
    [
      'exec',
      'vitest',
      'run',
      '--config',
      join(import.meta.dirname, 'vitest.prep.config.ts'),
      'tests/aides-e2e/fabrique-sauvegardes.prep.ts',
    ],
    { cwd: join(import.meta.dirname, '../..'), encoding: 'utf8' },
  );
  if (result.status !== 0)
    throw new Error(
      `fabrication des sauvegardes de départ en échec:\n${result.stdout}\n${result.stderr}`,
    );
}
