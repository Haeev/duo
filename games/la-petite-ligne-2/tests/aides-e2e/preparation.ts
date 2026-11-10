// `globalSetup` de Playwright: fabrique les sauvegardes de départ avant les parcours.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

export default function setup(): void {
  const result = spawnSync(
    'pnpm',
    ['exec', 'vitest', 'run', '--config', join(import.meta.dirname, 'vitest.prep.config.ts')],
    { cwd: join(import.meta.dirname, '../..'), encoding: 'utf8' },
  );
  if (result.status !== 0)
    throw new Error(
      `fabrication des sauvegardes de départ en échec:\n${result.stdout}\n${result.stderr}`,
    );
}
