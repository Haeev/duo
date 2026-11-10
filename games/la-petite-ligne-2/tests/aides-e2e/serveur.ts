// Un faux hôte (`servir`) par parcours: port libre et dossier de données propres, pour qu'aucune
// sauvegarde laissée par un parcours précédent ne change l'accueil du suivant (le bouton
// « Héberger » devient « Héberger et continuer » dès qu'une sauvegarde existe, et la
// confirmation de « nouvelle partie » est refusée d'office par Playwright).
import { spawn, type ChildProcess } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { e2eTempName } from './dossiers';

const SERVER = join(import.meta.dirname, '../../../../packages/sdk-dev/src/serveur/servir.ts');
/**
 * Dossier des sauvegardes de départ fabriquées par `fabrique-sauvegardes.prep.ts`, propre à cette
 * copie du dépôt (`e2eTempName`): deux recettes lancées en même temps depuis deux copies
 * (worktrees) s'écrasaient leurs sauvegardes, et un parcours partait d'une partie d'une autre version.
 */
export const FIXTURES = join(tmpdir(), e2eTempName('lpl2-e2e-fixtures'));

const running = new Set<ChildProcess>();
// Un parcours qui échoue avant `close` ne doit pas laisser de faux hôte derrière lui.
process.on('exit', () => {
  for (const child of running) child.kill();
});

export interface Serveur {
  readonly url: string;
  readonly dataDir: string;
  close(): Promise<void>;
}

async function freePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      probe.close(() => {
        resolve(port);
      });
    });
  });
}

/**
 * Démarre le faux hôte pour un parcours. `save`: nom d'une sauvegarde de départ de `FIXTURES`
 * (sans extension), copiée dans l'emplacement 1 du dossier de données; sans elle, partie neuve.
 */
export async function startServer(save?: string): Promise<Serveur> {
  const dataDir = mkdtempSync(join(tmpdir(), 'lpl2-e2e-données-'));
  if (save !== undefined) {
    mkdirSync(join(dataDir, 'sauvegardes'), { recursive: true });
    copyFileSync(
      join(FIXTURES, `${save}.json`),
      join(dataDir, 'sauvegardes', 'emplacement-1.json'),
    );
  }
  const port = await freePort();
  const child: ChildProcess = spawn(
    process.execPath,
    [
      '--experimental-strip-types',
      SERVER,
      'la-petite-ligne-2',
      '--port',
      String(port),
      '--donnees',
      dataDir,
    ],
    { stdio: 'ignore' },
  );
  running.add(child);
  const url = `http://localhost:${port}`;
  const started = Date.now();
  for (;;) {
    if (child.exitCode !== null)
      throw new Error(`le faux hôte s’est arrêté (code ${child.exitCode})`);
    try {
      if ((await fetch(`${url}/api/serveur`)).ok) break;
    } catch {
      // pas encore à l'écoute
    }
    if (Date.now() - started > 30_000) {
      child.kill();
      throw new Error('le faux hôte ne répond pas');
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return {
    url,
    dataDir,
    async close() {
      if (child.exitCode === null) {
        const exited = new Promise((resolve) => child.once('exit', resolve));
        child.kill();
        await exited;
      }
      running.delete(child);
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}
