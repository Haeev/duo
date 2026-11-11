// Installation des paquets (ADR 0010, point 5) et règle de version (ADR 0006):
// bascule atomique de `current.json`, jamais de retour en arrière, l'installée
// la plus récente l'emporte sur l'embarquée; lecture du catalogue et
// téléchargement contrôlé (ADR 0010, point 4).
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPackage } from '@duo/paquet';
import { scanGames } from '../../src/main/games/catalog';
import { GameInstaller } from '../../src/main/games/installer';
import { GameUpdater } from '../../src/main/games/updater';
import type { Journal } from '../../src/main/journal';

const FIXTURE = path.join(import.meta.dirname, '..', 'fixtures', 'jeux', 'essai-pont');
const TEST_KEY_PEM = path.join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  'packages',
  'paquet',
  'cle-test',
  'duo-test.pem',
);
const TEST_KEY = { id: 'duo-test', publicKey: 'BykDvRBr0nsJcew7Ilc4Dc4KYzGIyXYyLlJPAqBQxfs=' };
const journal: Journal = { write: () => undefined, flush: () => Promise.resolve() };

let work: string;
const packages = new Map<string, { file: string; size: number; sha256: string }>();

async function buildPackage(version: string): Promise<void> {
  const site = path.join(work, `site-${version}`);
  await cp(FIXTURE, site, { recursive: true });
  const manifestFile = path.join(site, 'duo-game.json');
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8')) as Record<string, unknown>;
  await writeFile(manifestFile, JSON.stringify({ ...manifest, version }));
  const created = await createPackage({
    siteDir: site,
    manifestFile,
    outDir: path.join(work, 'paquets'),
    privateKeyPem: await readFile(TEST_KEY_PEM, 'utf8'),
    keyId: 'duo-test',
  });
  packages.set(version, created);
}

function archive(version: string): string {
  const created = packages.get(version);
  if (created === undefined) throw new Error(`paquet ${version} absent`);
  return created.file;
}

beforeAll(async () => {
  // Espaces et accents dans le chemin, comme un dossier personnel « Hélène D ».
  work = await mkdtemp(path.join(tmpdir(), 'Hélène D données '));
  for (const version of ['1.0.0', '1.1.0', '0.9.0', '1.5.0', '2.1.0']) await buildPackage(version);
});

afterAll(async () => {
  await rm(work, { recursive: true, force: true });
});

describe('installation d’un paquet', () => {
  it('installe, bascule current.json, refuse l’égale et la plus ancienne, nettoie l’ancienne version', async () => {
    const gamesDir = path.join(work, 'donnees-1', 'games');
    let effective: string | null = null;
    const installer = new GameInstaller({
      gamesDir,
      trustedKeys: [TEST_KEY],
      effectiveVersion: () => effective,
    });
    const gameDir = path.join(gamesDir, 'essai-pont');
    const pointer = async (): Promise<unknown> =>
      JSON.parse(await readFile(path.join(gameDir, 'current.json'), 'utf8'));

    expect(await installer.install({ archive: archive('1.0.0'), move: false })).toMatchObject({
      ok: true,
      version: '1.0.0',
      previous: null,
    });
    expect(await pointer()).toMatchObject({ schema: 1, version: '1.0.0' });
    effective = '1.0.0';

    expect(await installer.install({ archive: archive('1.0.0'), move: false })).toMatchObject({
      ok: false,
      reason: 'not-newer',
    });
    expect(await installer.install({ archive: archive('0.9.0'), move: false })).toMatchObject({
      ok: false,
      reason: 'not-newer',
      version: '1.0.0',
    });

    expect(await installer.install({ archive: archive('1.1.0'), move: false })).toMatchObject({
      ok: true,
      version: '1.1.0',
      previous: '1.0.0',
    });
    expect(await pointer()).toMatchObject({ version: '1.1.0' });
    // Ni dossier temporaire, ni ancienne version: seulement la nouvelle, son archive et le pointeur.
    expect((await readdir(gameDir)).sort()).toEqual(['1.1.0', '1.1.0.duogame', 'current.json']);

    const catalog = await scanGames([{ source: 'installed', dir: gamesDir }]);
    expect(catalog.games.map((game) => [game.manifest.version, game.root])).toEqual([
      ['1.1.0', path.join(gameDir, '1.1.0')],
    ]);
  });

  it('ne touche à rien quand un fichier du paquet a été modifié', async () => {
    const gamesDir = path.join(work, 'donnees-2', 'games');
    const installer = new GameInstaller({
      gamesDir,
      trustedKeys: [TEST_KEY],
      effectiveVersion: () => null,
    });
    const bytes = await readFile(archive('1.0.0'));
    // Octet changé dans les données compressées de la dernière entrée (vignette): contrôle CRC ou empreinte.
    const tampered = Buffer.from(bytes);
    const index = tampered.lastIndexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04])) + 400;
    tampered[index] = (tampered[index] ?? 0) ^ 0xff;
    const file = path.join(work, 'abime.duogame');
    await writeFile(file, tampered);
    const outcome = await installer.install({ archive: file, move: false });
    expect(outcome).toMatchObject({ ok: false, reason: 'invalid' });
    expect(await readdir(gamesDir).catch(() => [])).toEqual([]);
  });

  it('la version installée la plus récente l’emporte sur l’embarquée, et inversement', async () => {
    const root = path.join(work, 'donnees-3');
    const gamesDir = path.join(root, 'games');
    const bundled = path.join(root, 'ressources');
    const embedded = path.join(bundled, 'essai-pont');
    await cp(FIXTURE, embedded, { recursive: true });
    const manifestFile = path.join(embedded, 'duo-game.json');
    const manifest = JSON.parse(await readFile(manifestFile, 'utf8')) as Record<string, unknown>;
    await writeFile(manifestFile, JSON.stringify({ ...manifest, version: '2.0.0' }));
    const roots = [
      { source: 'installed', dir: gamesDir },
      { source: 'bundled', dir: bundled },
    ] as const;

    const installer = new GameInstaller({
      gamesDir,
      trustedKeys: [TEST_KEY],
      effectiveVersion: () => '2.0.0',
    });
    // Plus ancienne que l'embarquée: refusée, l'embarquée reste jouée.
    expect(await installer.install({ archive: archive('1.5.0'), move: false })).toMatchObject({
      ok: false,
      reason: 'not-newer',
    });
    expect((await scanGames(roots)).games.map((game) => game.source)).toEqual(['bundled']);
    expect(await installer.install({ archive: archive('2.1.0'), move: false })).toMatchObject({
      ok: true,
    });
    expect(
      (await scanGames(roots)).games.map((game) => `${game.source}@${game.manifest.version}`),
    ).toEqual(['installed@2.1.0']);
  });
});

describe('recherche des jeux', () => {
  let server: Server;
  let base: string;
  let catalogue = '';

  beforeAll(async () => {
    server = createServer((request, response) => {
      if (request.url === '/catalogue.json') {
        response.end(catalogue);
        return;
      }
      if (request.url === '/essai-pont-1.1.0.duogame') {
        void readFile(archive('1.1.0')).then((bytes) => response.end(bytes));
        return;
      }
      response.statusCode = 404;
      response.end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  function updater(
    gamesDir: string,
    installed: string[],
    idle: () => boolean = () => true,
  ): GameUpdater {
    const installer = new GameInstaller({
      gamesDir,
      trustedKeys: [TEST_KEY],
      effectiveVersion: () => '1.0.0',
    });
    return new GameUpdater({
      catalogueUrl: `${base}/catalogue.json`,
      fetch: (url, init) => fetch(url, init),
      incomingDir: path.join(gamesDir, '.incoming'),
      install: (request) => installer.install(request),
      effectiveVersion: () => '1.0.0',
      isIdle: idle,
      allowUrl: () => true,
      onInstalled: (outcome) => {
        installed.push(`${outcome.id}@${outcome.version}`);
      },
      journal,
      retryDelaysMs: [],
    });
  }

  function entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    const created = packages.get('1.1.0');
    return {
      id: 'essai-pont',
      version: '1.1.0',
      manifeste: {
        nom: 'Essai du pont',
        description: 'Essai.',
        mode: 'coop',
        duree: [1, 10],
        sdk: '1.0',
      },
      taille: created?.size,
      url: `${base}/essai-pont-1.1.0.duogame`,
      sha256: created?.sha256,
      ...overrides,
    };
  }

  it('écarte une réponse invalide sans rien télécharger', async () => {
    const gamesDir = path.join(work, 'donnees-4', 'games');
    const installed: string[] = [];
    catalogue = '<!doctype html><p>Page de connexion du Wi-Fi</p>';
    expect(await updater(gamesDir, installed).check()).toMatchObject({
      kind: 'failed',
      step: 'catalogue',
    });
    catalogue = JSON.stringify({ schema: 99, jeux: [entry()] });
    expect(await updater(gamesDir, installed).check()).toMatchObject({
      kind: 'failed',
      step: 'catalogue',
    });
    expect(installed).toEqual([]);
    expect(await readdir(gamesDir).catch(() => [])).toEqual([]);
  });

  it('refuse une archive dont l’empreinte diffère du catalogue, installe la bonne, jamais pendant une partie', async () => {
    const gamesDir = path.join(work, 'donnees-5', 'games');
    const installed: string[] = [];
    catalogue = JSON.stringify({ schema: 1, jeux: [entry({ sha256: 'b'.repeat(64) })] });
    expect(await updater(gamesDir, installed).check()).toMatchObject({
      kind: 'failed',
      step: 'download',
    });
    expect(await readdir(path.join(gamesDir, '.incoming'))).toEqual([]);

    catalogue = JSON.stringify({ schema: 1, jeux: [entry()] });
    expect(await updater(gamesDir, installed, () => false).check()).toEqual({ kind: 'deferred' });
    expect(installed).toEqual([]);

    expect(await updater(gamesDir, installed).check()).toEqual({ kind: 'done', installed: 1 });
    expect(installed).toEqual(['essai-pont@1.1.0']);
    expect(
      JSON.parse(await readFile(path.join(gamesDir, 'essai-pont', 'current.json'), 'utf8')),
    ).toEqual({
      schema: 1,
      version: '1.1.0',
      sha256: packages.get('1.1.0')?.sha256,
    });
  });

  it('empreinte différente: échec « intégrité », la version installée reste en place et jouable', async () => {
    const gamesDir = path.join(work, 'donnees-6', 'games');
    const installer = new GameInstaller({
      gamesDir,
      trustedKeys: [TEST_KEY],
      effectiveVersion: () => null,
    });
    const first = await installer.install({ archive: archive('1.0.0'), move: false });
    expect(first).toMatchObject({ ok: true, version: '1.0.0' });
    const pointer = path.join(gamesDir, 'essai-pont', 'current.json');
    const before = await readFile(pointer, 'utf8');

    const installed: string[] = [];
    catalogue = JSON.stringify({ schema: 1, jeux: [entry({ sha256: 'c'.repeat(64) })] });
    const instance = updater(gamesDir, installed);
    expect(await instance.check()).toMatchObject({ kind: 'failed', step: 'download' });
    expect(instance.snapshot().games.get('essai-pont')).toEqual({
      kind: 'failed',
      version: '1.1.0',
      playAnyway: false,
      cause: 'integrity',
    });
    expect(installed).toEqual([]);
    expect(await readFile(pointer, 'utf8')).toBe(before);
    expect(await readdir(path.join(gamesDir, 'essai-pont'))).not.toContain('1.1.0');
    expect(await readdir(path.join(gamesDir, '.incoming'))).toEqual([]);
    const games = await scanGames([{ source: 'installed', dir: gamesDir }]);
    expect(games.games.map((game) => game.manifest.version)).toEqual(['1.0.0']);
  });

  it('catalogue ancien sans empreinte: installe le paquet, dont la signature reste contrôlée', async () => {
    const gamesDir = path.join(work, 'donnees-7', 'games');
    const installed: string[] = [];
    const ancienne = entry();
    delete ancienne.sha256;
    catalogue = JSON.stringify({ schema: 1, jeux: [ancienne] });
    expect(await updater(gamesDir, installed).check()).toEqual({ kind: 'done', installed: 1 });
    expect(installed).toEqual(['essai-pont@1.1.0']);
    expect(
      JSON.parse(await readFile(path.join(gamesDir, 'essai-pont', 'current.json'), 'utf8')),
    ).toEqual({ schema: 1, version: '1.1.0', sha256: null });
  });
});
