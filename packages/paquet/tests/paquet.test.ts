// Vérification des paquets (ADR 0010, point 1): un paquet sain passe; une
// signature fausse, un fichier modifié, une entrée en trop ou un nom avec `..`
// sont refusés. Les archives altérées sont refaites à partir d'un paquet sain.
import { generateKeyPairSync } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import yauzl from 'yauzl';
import yazl from 'yazl';
import {
  createPackage,
  parseCatalogue,
  parseCatalogueText,
  verifyPackage,
  type TrustedKey,
} from '../src/index.ts';

const TEST_KEY_PEM = path.join(import.meta.dirname, '..', 'cle-test', 'duo-test.pem');
const TEST_KEY: TrustedKey = {
  id: 'duo-test',
  publicKey: 'BykDvRBr0nsJcew7Ilc4Dc4KYzGIyXYyLlJPAqBQxfs=',
};

let work: string;
let sound: string;

async function makeGame(dir: string, version: string): Promise<string> {
  const site = path.join(dir, 'dist');
  await mkdir(path.join(site, 'assets'), { recursive: true });
  await writeFile(path.join(site, 'index.html'), '<!doctype html><title>Essai</title>');
  await writeFile(path.join(site, 'assets', 'jeu.js'), 'export const x = 1;');
  await writeFile(path.join(site, 'assets', 'jeu.js.map'), '{}');
  const manifest = {
    schema: 1,
    id: 'essai-paquet',
    name: 'Essai de paquet',
    version,
    sdk: '1.0',
    mode: 'coop',
    durationMinutes: [5, 10],
    description: 'Jeu de test du format de paquet.',
    entry: 'index.html',
  };
  const manifestFile = path.join(dir, 'duo-game.json');
  await writeFile(manifestFile, JSON.stringify(manifest));
  return manifestFile;
}

/** Entrées d'une archive, dans l'ordre. */
async function readZip(file: string): Promise<[string, Buffer][]> {
  const zip = await yauzl.openPromise(file, { lazyEntries: true, autoClose: false });
  const out: [string, Buffer][] = [];
  for await (const entry of zip.eachEntry()) {
    const chunks: Buffer[] = [];
    for await (const chunk of (await zip.openReadStreamPromise(entry)) as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }
    out.push([entry.fileName, Buffer.concat(chunks)]);
  }
  zip.close();
  return out;
}

async function writeZip(file: string, entries: readonly [string, Buffer][]): Promise<void> {
  const zip = new yazl.ZipFile();
  for (const [name, bytes] of entries) zip.addBuffer(bytes, name);
  zip.end();
  const chunks: Buffer[] = [];
  for await (const chunk of zip.outputStream as AsyncIterable<Buffer>) chunks.push(chunk);
  await writeFile(file, Buffer.concat(chunks));
}

beforeAll(async () => {
  work = await mkdtemp(path.join(tmpdir(), 'duo paquet é '));
  const manifestFile = await makeGame(work, '1.2.0');
  const created = await createPackage({
    siteDir: path.join(work, 'dist'),
    manifestFile,
    outDir: path.join(work, 'sortie'),
    privateKeyPem: await readFile(TEST_KEY_PEM, 'utf8'),
    keyId: 'duo-test',
  });
  sound = created.file;
  expect(path.basename(sound)).toBe('essai-paquet-1.2.0.duogame');
});

afterAll(async () => {
  await rm(work, { recursive: true, force: true });
});

describe('vérification du paquet', () => {
  it('accepte un paquet sain et l’extrait, sans les cartes des sources', async () => {
    const target = path.join(work, 'extrait');
    const result = await verifyPackage(sound, { trustedKeys: [TEST_KEY], extractTo: target });
    expect(result).toMatchObject({
      ok: true,
      id: 'essai-paquet',
      version: '1.2.0',
      keyId: 'duo-test',
    });
    const names = (await readdir(target, { recursive: true })).map((name) =>
      name.split(path.sep).join('/'),
    );
    expect(names.sort()).toEqual(['assets', 'assets/jeu.js', 'duo-game.json', 'index.html']);
  });

  it('refuse une clé inconnue et une signature fausse', async () => {
    expect(await verifyPackage(sound, { trustedKeys: [] })).toMatchObject({
      ok: false,
      problem: 'unknown-key',
    });
    // Même identifiant, autre clé publique: la signature ne correspond pas.
    const other = generateKeyPairSync('ed25519').publicKey.export({ format: 'jwk' });
    const impostor = {
      id: 'duo-test',
      publicKey: Buffer.from(other.x ?? '', 'base64url').toString('base64'),
    };
    expect(await verifyPackage(sound, { trustedKeys: [impostor] })).toMatchObject({
      ok: false,
      problem: 'bad-signature',
    });
  });

  it('refuse un fichier modifié après la signature', async () => {
    const entries = await readZip(sound);
    const altered = entries.map(([name, bytes]): [string, Buffer] =>
      name === 'assets/jeu.js' ? [name, Buffer.from('export const x = 2;')] : [name, bytes],
    );
    const file = path.join(work, 'modifie.duogame');
    await writeZip(file, altered);
    expect(await verifyPackage(file, { trustedKeys: [TEST_KEY] })).toMatchObject({
      ok: false,
      problem: 'hash-mismatch',
      detail: 'assets/jeu.js',
    });
  });

  it('refuse une entrée en trop', async () => {
    const file = path.join(work, 'en-trop.duogame');
    await writeZip(file, [
      ...(await readZip(sound)),
      ['assets/intrus.js', Buffer.from('alert(1)')],
    ]);
    expect(await verifyPackage(file, { trustedKeys: [TEST_KEY] })).toMatchObject({
      ok: false,
      problem: 'extra-entry',
      detail: 'assets/intrus.js',
    });
  });

  it('refuse un nom d’entrée avec « .. »', async () => {
    const file = path.join(work, 'sortie-du-dossier.duogame');
    await writeZip(file, [...(await readZip(sound)), ['zz/evil.js', Buffer.from('x')]]);
    // yazl refuse d'écrire « .. »: le nom est remplacé dans les octets (en-tête local et répertoire central).
    const bytes = await readFile(file);
    await writeFile(
      file,
      Buffer.from(bytes.toString('latin1').replaceAll('zz/evil.js', '../evil.js'), 'latin1'),
    );
    expect(await verifyPackage(file, { trustedKeys: [TEST_KEY] })).toMatchObject({
      ok: false,
      problem: 'bad-entry-name',
    });
  });

  it('applique la validation complète du manifeste fournie par l’appelant', async () => {
    const result = await verifyPackage(sound, {
      trustedKeys: [TEST_KEY],
      checkManifest: () => ({ ok: false, problems: ['actions: manquant'] }),
    });
    expect(result).toMatchObject({ ok: false, problem: 'bad-manifest' });
  });
});

describe('catalogue', () => {
  const entry = {
    id: 'la-petite-ligne',
    version: '0.2.0',
    manifeste: {
      nom: 'La Petite Ligne',
      description: 'Six semaines.',
      mode: 'coop',
      duree: [30, 75],
      sdk: '1.0',
    },
    taille: 1234,
    url: 'https://github.com/Haeev/duo/releases/download/jeu-la-petite-ligne-v0.2.0/la-petite-ligne-0.2.0.duogame',
    sha256: 'a'.repeat(64),
  };

  it('écarte une réponse invalide ou d’un schéma inconnu', () => {
    expect(parseCatalogueText('<html>Not Found</html>')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseCatalogue({ jeux: [entry] })).toEqual({ ok: false, reason: 'invalid' });
    expect(parseCatalogue({ schema: 2, jeux: [entry] })).toEqual({
      ok: false,
      reason: 'unknown-schema',
    });
  });

  it('ignore une entrée invalide et garde la version la plus récente d’un jeu', () => {
    const result = parseCatalogue({
      schema: 1,
      jeux: [
        entry,
        { ...entry, version: '0.10.0' },
        { ...entry, id: 'Mauvais id' },
        { ...entry, sha256: 'xyz' },
      ],
    });
    expect(result).toMatchObject({ ok: true, skipped: 2 });
    expect(result.ok && result.entries.map((item) => item.version)).toEqual(['0.10.0']);
  });
});
