// Sauvegardes simultanées du même emplacement (qa-testeur, recette du 2026-10-31, bug LPL-R07):
// pendant l'endurance à deux navigateurs, `servir` a journalisé « Erreur sur PUT /api/sauvegardes/1:
// ENOENT ... rename emplacement-1.json.tmp -> emplacement-1.json ». Deux écritures du même emplacement
// partagent le même fichier temporaire: la seconde le tronque pendant que la première le renomme, puis
// ne le trouve plus. `it.fails` garde la CI verte tant que le bug est ouvert: une fois corrigé, ce test
// échoue, remplacer `it.fails` par `it`.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDiskStore } from '../src/serveur/disque.ts';

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('sauvegardes simultanées', () => {
  it.fails('deux écritures du même emplacement en même temps réussissent, l’une des deux dernières reste', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'duo-sdk-dev-concurrence-'));
    dirs.push(dir);
    const store = createDiskStore(dir);
    const base = { slot: 1, dataSchema: 1, gameVersion: '0.1.0', moment: 'manual', savedAt: '2026-10-31T00:00:00Z' };
    // Une sauvegarde de taille réaliste (25 Kio), écrite plusieurs fois de suite deux par deux.
    const data = (n: number): string => JSON.stringify({ n, pad: 'x'.repeat(25_000) });
    for (let round = 0; round < 10; round++) {
      await Promise.all([
        store.write({ ...base, label: `aube ${round}`, data: data(round * 2) }),
        store.write({ ...base, label: `étape ${round}`, data: data(round * 2 + 1) }),
      ]);
    }
    const last = await store.read(1);
    expect([data(18), data(19)]).toContain(last?.data);
  });
});
