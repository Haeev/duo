import { cp, mkdtemp, readFile, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { scanGames } from '../../src/main/games/catalog';
import { bridgeCovers, checkManifest } from '../../src/main/games/manifest';

vi.mock('electron', () => ({ protocol: { registerSchemesAsPrivileged: vi.fn() } }));
const { mimeType, parseRange, resolveInside } = await import('../../src/main/protocols');

const FIXTURES = path.resolve(import.meta.dirname, '..', 'fixtures', 'jeux');

describe('chemins servis par les protocoles', () => {
  const root = path.resolve('/jeux/essai');

  it('résout un chemin dans le dossier du jeu', () => {
    expect(resolveInside(root, '/index.html')).toBe(path.join(root, 'index.html'));
    expect(resolveInside(root, '/assets/mod%C3%A8le%20un.glb')).toBe(path.join(root, 'assets', 'modèle un.glb'));
  });

  it('refuse toute sortie du dossier et les chemins suspects', () => {
    for (const attempt of ['/../secret', '/a/../../b', '/%2e%2e/x', '/a%5Cb', '/x%00y', '/C:/Windows', '/%E0%A4%A']) {
      expect(resolveInside(root, attempt)).toBeNull();
    }
  });

  it('donne les types MIME des fichiers de jeu', () => {
    expect(mimeType('a.glb')).toBe('model/gltf-binary');
    expect(mimeType('a.OGG')).toBe('audio/ogg');
    expect(mimeType('a.inconnu')).toBe('application/octet-stream');
  });

  it('lit les requêtes partielles (lecture en flux)', () => {
    expect(parseRange(null, 100)).toBeNull();
    expect(parseRange('bytes=0-9', 100)).toEqual({ start: 0, end: 9 });
    expect(parseRange('bytes=90-', 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange('bytes=50-500', 100)).toEqual({ start: 50, end: 99 });
    expect(parseRange('bytes=100-', 100)).toBe('invalid');
    expect(parseRange('octets=1-2', 100)).toBe('invalid');
  });
});

describe('manifeste duo-game.json (ADR 0005, point 2)', () => {
  const valid = {
    schema: 1,
    id: 'essai',
    name: 'Essai',
    version: '1.0.0',
    sdk: '1.0',
    view: '3d',
    engine: 'three',
    mode: 'coop',
    play: 'session',
    durationMinutes: [20, 60],
    network: 'host-authority',
    entry: 'index.html',
    thumbnail: 'vignette.webp',
    description: 'Un essai.',
    whatsNew: '',
    actions: [{ id: 'agir', label: 'Agir', keys: ['Space'] }],
    saves: { slots: 1, maxBytes: 1024, moments: ['exit'] },
    credits: null,
  };

  it('accepte un manifeste conforme', () => {
    const check = checkManifest(valid);
    expect(check.ok).toBe(true);
  });

  it('refuse Échap, un identifiant invalide, un chemin qui sort du paquet', () => {
    const escape = checkManifest({ ...valid, actions: [{ id: 'pause', label: 'Pause', keys: ['Escape'] }] });
    expect(escape.ok).toBe(false);
    expect(checkManifest({ ...valid, id: 'Essai' }).ok).toBe(false);
    expect(checkManifest({ ...valid, inconnu: 1 }).ok).toBe(false);
    expect(checkManifest({ ...valid, durationMinutes: [60, 20] }).ok).toBe(false);
    expect(checkManifest({ ...valid, saves: { slots: 1, maxBytes: 1024, moments: ['auto'] } }).ok).toBe(false);
  });

  it('compare la version du pont exigée à celle de l’application', () => {
    expect(bridgeCovers('1.0')).toBe(true);
    expect(bridgeCovers('1.3')).toBe(false);
    expect(bridgeCovers('2.0')).toBe(false);
  });
});

describe('catalogue des jeux', () => {
  it('trouve le jeu d’essai et écarte un manifeste invalide sans toucher aux autres (M-12)', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'duo-jeux-'));
    await cp(path.join(FIXTURES, 'essai-pont'), path.join(dir, 'essai-pont'), { recursive: true });
    await cp(path.join(FIXTURES, 'essai-pont'), path.join(dir, 'mauvais'), { recursive: true });
    await writeFile(path.join(dir, 'mauvais', 'duo-game.json'), '{ "schema": 1 }');
    const catalog = await scanGames([{ source: 'extra', dir }]);
    expect(catalog.games.map((game) => game.manifest.id)).toEqual(['essai-pont']);
    expect(catalog.games[0]?.compatible).toBe(true);
    expect(catalog.problems).toHaveLength(1);
    expect(catalog.problems[0]?.folder).toContain('mauvais');
  });

  it('lit un paquet du dépôt: duo-game.json à la racine, site construit dans dist/', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'duo-depot-'));
    await cp(path.join(FIXTURES, 'essai-pont'), path.join(dir, 'essai-pont', 'dist'), { recursive: true });
    await rename(path.join(dir, 'essai-pont', 'dist', 'duo-game.json'), path.join(dir, 'essai-pont', 'duo-game.json'));
    const catalog = await scanGames([{ source: 'dev', dir }]);
    expect(catalog.games[0]?.root).toBe(path.join(dir, 'essai-pont', 'dist'));
  });

  it('refuse une page d’entrée qui sort du paquet', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'duo-sortie-'));
    await cp(path.join(FIXTURES, 'essai-pont'), path.join(dir, 'essai-pont'), { recursive: true });
    const manifest = JSON.parse(await readFile(path.join(dir, 'essai-pont', 'duo-game.json'), 'utf8')) as Record<string, unknown>;
    await writeFile(path.join(dir, 'essai-pont', 'duo-game.json'), JSON.stringify({ ...manifest, entry: '../../secret.html' }));
    const catalog = await scanGames([{ source: 'extra', dir }]);
    expect(catalog.games).toEqual([]);
    expect(catalog.problems).toHaveLength(1);
  });
});
