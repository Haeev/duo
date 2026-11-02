// Création d'un paquet `.duogame` reproductible (ADR 0010, point 1): mêmes
// fichiers et même clé, même archive octet pour octet (dates figées, ordre fixe,
// droits fixes).
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { lstat, mkdir, readFile, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import * as v from 'valibot';
import yazl from 'yazl';
import {
  FILE_LIST_NAME,
  MANIFEST_NAME,
  MAX_ENTRIES,
  MAX_PACKAGE_BYTES,
  ManifestCoreSchema,
  SIGNATURE_NAME,
  isSafePackagePath,
  packageFileName,
  type FileList,
  type ManifestCore,
  type SignatureFile,
} from './format.ts';
import { privateKeyFromPem, signBytes } from './keys.ts';

export interface CreateOptions {
  /** Site construit du jeu (sortie `dist/` de Vite). */
  readonly siteDir: string;
  /** `duo-game.json` du jeu: celui du site s'il y en a un, sinon celui du paquet du jeu. */
  readonly manifestFile: string;
  readonly outDir: string;
  /** Clé privée Ed25519, PEM PKCS8. */
  readonly privateKeyPem: string;
  readonly keyId: string;
}

export interface CreatedPackage {
  readonly id: string;
  readonly version: string;
  readonly file: string;
  readonly size: number;
  readonly sha256: string;
  readonly manifest: ManifestCore;
}

// Date figée, construite en heure locale: yazl écrit l'heure DOS avec les
// accesseurs locaux, donc la même date donne les mêmes octets dans tout fuseau.
const FIXED_DATE = new Date(2000, 0, 1, 0, 0, 0);
const FILE_MODE = 0o100644;
const RESERVED = new Set([MANIFEST_NAME, FILE_LIST_NAME, SIGNATURE_NAME]);

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Fichiers du site, chemins `/`, triés par point de code (indépendant de la langue). */
async function listSite(siteDir: string): Promise<string[]> {
  const found: string[] = [];
  const walk = async (dir: string, prefix: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
      const full = path.join(dir, entry.name);
      const info = await lstat(full);
      if (info.isSymbolicLink())
        throw new Error(`lien symbolique refusé dans le site: ${relative}`);
      if (info.isDirectory()) {
        await walk(full, relative);
      } else if (info.isFile()) {
        // Cartes des sources: inutiles chez les joueurs (même règle que les jeux embarqués).
        if (relative.endsWith('.map')) continue;
        if (prefix === '' && RESERVED.has(entry.name)) continue;
        found.push(relative);
      }
    }
  };
  await walk(siteDir, '');
  return found.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export async function createPackage(options: CreateOptions): Promise<CreatedPackage> {
  const privateKey = privateKeyFromPem(options.privateKeyPem);
  const manifestBytes = await readFile(options.manifestFile);
  let rawManifest: unknown;
  try {
    rawManifest = JSON.parse(manifestBytes.toString('utf8'));
  } catch (error) {
    throw new Error(`${options.manifestFile}: JSON invalide`, { cause: error });
  }
  const parsed = v.safeParse(ManifestCoreSchema, rawManifest);
  if (!parsed.success) {
    const details = parsed.issues.map((issue) => {
      const where = v.getDotPath(issue);
      return where === null ? issue.message : `${where}: ${issue.message}`;
    });
    throw new Error(`${options.manifestFile}: manifeste invalide (${details.join('; ')})`);
  }
  const manifest = parsed.output;

  const sitePaths = await listSite(options.siteDir);
  if (!sitePaths.includes(manifest.entry)) {
    throw new Error(`page d'entrée ${manifest.entry} absente de ${options.siteDir}`);
  }
  const contents = new Map<string, Buffer>([[MANIFEST_NAME, manifestBytes]]);
  for (const relative of sitePaths) {
    if (!isSafePackagePath(relative)) throw new Error(`nom de fichier refusé: ${relative}`);
    contents.set(relative, await readFile(path.join(options.siteDir, ...relative.split('/'))));
  }
  const lowered = new Set<string>();
  let total = 0;
  for (const [relative, bytes] of contents) {
    // macOS et Windows ne distinguent pas la casse: deux noms qui ne diffèrent que par elle s'écrasent.
    const key = relative.toLowerCase();
    if (lowered.has(key))
      throw new Error(`deux fichiers ne diffèrent que par la casse: ${relative}`);
    lowered.add(key);
    total += bytes.length;
  }
  if (contents.size > MAX_ENTRIES) throw new Error(`trop de fichiers: ${contents.size}`);
  if (total > MAX_PACKAGE_BYTES) {
    throw new Error(`paquet trop lourd: ${total} octets, plafond ${MAX_PACKAGE_BYTES}`);
  }

  const ordered = [...contents.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const fileList: FileList = {
    schema: 1,
    id: manifest.id,
    version: manifest.version,
    files: ordered.map((relative) => {
      const bytes = contents.get(relative) ?? Buffer.alloc(0);
      return { path: relative, size: bytes.length, sha256: sha256(bytes) };
    }),
  };
  const listBytes = Buffer.from(`${JSON.stringify(fileList, null, 2)}\n`, 'utf8');
  const signatureFile: SignatureFile = {
    schema: 1,
    keyId: options.keyId,
    signature: signBytes(listBytes, privateKey).toString('base64'),
  };
  const signatureBytes = Buffer.from(`${JSON.stringify(signatureFile, null, 2)}\n`, 'utf8');

  const zip = new yazl.ZipFile();
  const entryOptions = { mtime: FIXED_DATE, mode: FILE_MODE, forceDosTimestamp: true };
  zip.addBuffer(listBytes, FILE_LIST_NAME, { ...entryOptions, compress: true });
  zip.addBuffer(signatureBytes, SIGNATURE_NAME, { ...entryOptions, compress: false });
  for (const relative of ordered) {
    zip.addBuffer(contents.get(relative) ?? Buffer.alloc(0), relative, {
      ...entryOptions,
      compress: true,
    });
  }
  zip.end();

  await mkdir(options.outDir, { recursive: true });
  const file = path.join(options.outDir, packageFileName(manifest.id, manifest.version));
  const partial = `${file}.part`;
  try {
    await pipeline(zip.outputStream, createWriteStream(partial));
    await rename(partial, file);
  } catch (error) {
    await rm(partial, { force: true });
    throw error;
  }
  const written = await readFile(file);
  return {
    id: manifest.id,
    version: manifest.version,
    file,
    size: written.length,
    sha256: sha256(written),
    manifest,
  };
}
