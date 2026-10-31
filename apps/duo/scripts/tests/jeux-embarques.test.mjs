// @ts-check
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bundledGameFolders, extraResourcesFor, resolveBundledGames } from '../jeux-embarques.mjs';
import { bundledGamesInCatalog, parseJournal } from '../test-demarrage.mjs';

describe('jeux embarqués', () => {
  /** @type {string} */
  let root = '';

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'Duo dépôt '));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  /**
   * @param {string} folder
   * @param {{ manifest?: unknown, inDist?: boolean, built?: boolean }} options
   */
  async function game(
    folder,
    {
      manifest = { id: 'petit-jeu', version: '0.2.0', entry: 'index.html' },
      inDist = false,
      built = true,
    },
  ) {
    const dir = path.join(root, ...folder.split('/'));
    await mkdir(path.join(dir, 'dist'), { recursive: true });
    const text = typeof manifest === 'string' ? manifest : JSON.stringify(manifest);
    await writeFile(path.join(dir, inDist ? 'dist' : '', 'duo-game.json'), text);
    if (built) await writeFile(path.join(dir, 'dist', 'index.html'), '<!doctype html>');
  }

  it('lit le manifeste du paquet et prépare la copie dans games/<id>', async () => {
    await game('games/petit-jeu', {});
    const games = resolveBundledGames(root, ['games/petit-jeu']);
    expect(games).toMatchObject([{ id: 'petit-jeu', version: '0.2.0' }]);
    expect(extraResourcesFor(games)).toEqual([
      {
        from: path.join(root, 'games', 'petit-jeu', 'dist'),
        to: 'games/petit-jeu',
        filter: ['**/*', '!**/*.map', '!duo-game.json'],
      },
      {
        from: path.join(root, 'games', 'petit-jeu', 'duo-game.json'),
        to: 'games/petit-jeu/duo-game.json',
      },
    ]);
  });

  it('préfère le manifeste construit dans dist', async () => {
    await game('games/petit-jeu', { inDist: true });
    const [entry] = resolveBundledGames(root, ['games/petit-jeu']);
    expect(entry?.manifest).toBe(path.join(root, 'games', 'petit-jeu', 'dist', 'duo-game.json'));
  });

  it('refuse un jeu non construit, sans manifeste, ou au manifeste invalide', async () => {
    await game('games/a', { built: false });
    expect(() => resolveBundledGames(root, ['games/a'])).toThrow(/pnpm build:app/);
    await mkdir(path.join(root, 'games', 'b', 'dist'), { recursive: true });
    expect(() => resolveBundledGames(root, ['games/b'])).toThrow(/introuvable/);
    await game('games/c', { manifest: '{ pas du json' });
    expect(() => resolveBundledGames(root, ['games/c'])).toThrow(/JSON/);
    await game('games/d', { manifest: { id: '_essai', version: '1.0.0', entry: 'index.html' } });
    expect(() => resolveBundledGames(root, ['games/d'])).toThrow(/identifiant/);
    await game('games/e', { manifest: { id: 'e', version: '1.0.0', entry: '../index.html' } });
    expect(() => resolveBundledGames(root, ['games/e'])).toThrow(/entrée/);
  });

  it('refuse deux jeux au même identifiant', async () => {
    await game('games/un', {});
    await game('games/deux', {});
    expect(() => resolveBundledGames(root, ['games/un', 'games/deux'])).toThrow(/deux fois/);
  });

  it('laisse DUO_JEUX_EMBARQUES remplacer la liste', () => {
    expect(bundledGameFolders(['games/la-petite-ligne'], {})).toEqual(['games/la-petite-ligne']);
    expect(
      bundledGameFolders(['games/la-petite-ligne'], { DUO_JEUX_EMBARQUES: ' games/a , games/b,' }),
    ).toEqual(['games/a', 'games/b']);
    expect(bundledGameFolders(['games/la-petite-ligne'], { DUO_JEUX_EMBARQUES: '' })).toEqual([]);
  });
});

describe('journal lu par le test de démarrage', () => {
  it('trouve les événements et les jeux embarqués du catalogue', () => {
    const text = [
      JSON.stringify({ at: 't', level: 'info', module: 'app', event: 'starting' }),
      JSON.stringify({
        level: 'info',
        module: 'games',
        event: 'catalog',
        details: { games: ['la-petite-ligne@0.1.0 (bundled)', 'echo@0.1.0 (dev)'] },
      }),
      '{"level":"info","event":"launcher-re',
    ].join('\n');
    const lines = parseJournal(text);
    expect(lines.map((line) => line.event)).toEqual(['starting', 'catalog']);
    expect(bundledGamesInCatalog(lines)).toEqual(['la-petite-ligne']);
  });
});
