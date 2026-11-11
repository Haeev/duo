// Historique du prototype (ADR 0009, point 8): une entrée par partie ou séance, complétée
// une fois par le résumé du jeu, lue la plus récente d'abord pour le salon.
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LocalHistory, type HistoryEntry } from '../../src/main/data/local-history';
import { historyItem } from '../../src/main/platform';

let work: string;

beforeAll(async () => {
  // Espaces et accents, comme un dossier personnel « Hélène D ».
  work = await mkdtemp(path.join(tmpdir(), 'Hélène D historique '));
});

afterAll(async () => {
  await rm(work, { recursive: true, force: true });
});

function entry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    schema: 1,
    matchId: '3f0c2a7e-1b2d-4c5e-8f90-a1b2c3d4e5f6',
    gameId: 'la-petite-ligne-2',
    gameVersion: '0.21.0',
    play: 'session',
    role: 'host',
    endedAt: '2026-11-11T20:40:00.000Z',
    durationMs: 47 * 60_000,
    reason: 'stopped',
    outcome: null,
    progress: null,
    stats: [],
    ...overrides,
  };
}

describe('historique local', () => {
  it('inscrit, complète au même endroit, et relit les dernières entrées dans l’ordre', async () => {
    const history = new LocalHistory(path.join(work, 'donnees-1'));
    await history.record(entry({ matchId: 'partie-a', endedAt: '2026-11-09T20:00:00.000Z' }));
    await history.record(entry({ matchId: 'partie-b', endedAt: '2026-11-10T20:00:00.000Z' }));
    await history.record(entry({ matchId: 'partie-c' }));
    // Le résumé du jeu arrive après la fin: même fichier, contenu complété.
    await history.record(
      entry({
        matchId: 'partie-c',
        progress: 0.35,
        stats: [
          { label: 'Jours vécus', value: '2' },
          { label: 'Étapes de quête franchies', value: '4' },
          { label: 'Entrées de collection ajoutées', value: '3' },
        ],
      }),
    );
    const dir = path.join(work, 'donnees-1', 'historique-local', 'la-petite-ligne-2');
    expect((await readdir(dir)).sort()).toEqual([
      '20261109T200000Z-partie-a.json',
      '20261110T200000Z-partie-b.json',
      '20261111T204000Z-partie-c.json',
    ]);
    const recent = await history.recent('la-petite-ligne-2', 2);
    expect(recent.map((item) => item.matchId)).toEqual(['partie-c', 'partie-b']);
    expect(recent[0]).toMatchObject({ progress: 0.35, stats: [{ label: 'Jours vécus' }, {}, {}] });
    expect(await history.recent('autre-jeu', 3)).toEqual([]);
  });

  it('refuse une entrée hors limites ou un identifiant de partie qui sortirait du dossier', async () => {
    const history = new LocalHistory(path.join(work, 'donnees-2'));
    await expect(history.record(entry({ matchId: '../../evasion' }))).rejects.toThrow();
    await expect(
      history.record(entry({ stats: [{ label: 'x'.repeat(33), value: '1' }] })),
    ).rejects.toThrow();
    await expect(
      history.record(
        entry({
          stats: [
            { label: 'a', value: '1' },
            { label: 'b', value: '2' },
            { label: 'c', value: '3' },
            { label: 'd', value: '4' },
          ],
        }),
      ),
    ).rejects.toThrow();
    expect(await history.recent('la-petite-ligne-2', 3)).toEqual([]);
  });

  it('passe un fichier abîmé sans perdre les autres', async () => {
    const history = new LocalHistory(path.join(work, 'donnees-3'));
    await history.record(entry({ matchId: 'bonne', endedAt: '2026-11-10T20:00:00.000Z' }));
    const dir = path.join(work, 'donnees-3', 'historique-local', 'la-petite-ligne-2');
    await writeFile(path.join(dir, '20261111T200000Z-abimee.json'), '{"schema": 1, "matchId"');
    expect((await history.recent('la-petite-ligne-2', 3)).map((item) => item.matchId)).toEqual([
      'bonne',
    ]);
  });
});

describe('entrée vue de chaque machine', () => {
  it('séance quittée, interrompue, ou partie gagnée selon la place', () => {
    expect(historyItem(entry()).result).toBe('session');
    expect(historyItem(entry({ reason: 'crash' })).result).toBe('interrupted');
    expect(historyItem(entry({ play: 'match', reason: 'stopped' })).result).toBe('interrupted');
    const won = entry({ play: 'match', reason: 'end', outcome: 'win-host' });
    expect(historyItem(won).result).toBe('won');
    expect(historyItem({ ...won, role: 'guest' }).result).toBe('lost');
    expect(historyItem(entry({ reason: 'end', outcome: null })).result).toBe('session');
    expect(historyItem(entry()).endedAt).toBe(Date.parse('2026-11-11T20:40:00.000Z'));
  });
});
