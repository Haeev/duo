// Vérification complète d'un paquet `.duogame` (ADR 0010, point 1), identique
// pour un téléchargement, une copie par le réseau local ou un import: signature
// par une clé de confiance, liste des fichiers, manifeste, empreinte de chaque
// entrée, aucune entrée de trop, noms valides, plafond de taille. Avec
// `extractTo`, chaque fichier est écrit pendant son contrôle: le dossier n'est
// utilisable que si le résultat est `ok` (l'appelant supprime sinon).
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { Transform, Writable, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import * as v from 'valibot';
import yauzl from 'yauzl';
import {
  FILE_LIST_NAME,
  FileListSchema,
  MANIFEST_NAME,
  MAX_ENTRIES,
  MAX_METADATA_BYTES,
  MAX_PACKAGE_BYTES,
  ManifestCoreSchema,
  SIGNATURE_NAME,
  SignatureFileSchema,
  isSafePackagePath,
  type FileList,
  type ManifestCore,
} from './format.ts';
import { publicKeyFromRaw, verifyBytes, type TrustedKey } from './keys.ts';

export type PackageProblem =
  | 'unreadable'
  | 'too-large'
  | 'bad-entry-name'
  | 'duplicate-entry'
  | 'missing-signature'
  | 'unknown-key'
  | 'bad-signature'
  | 'bad-file-list'
  | 'missing-entry'
  | 'extra-entry'
  | 'size-mismatch'
  | 'hash-mismatch'
  | 'bad-manifest';

export type ManifestCheck =
  { readonly ok: true } | { readonly ok: false; readonly problems: readonly string[] };

export interface VerifyOptions {
  readonly trustedKeys: readonly TrustedKey[];
  /** Validation complète du manifeste (schéma de `@duo/protocol`). */
  readonly checkManifest?: (raw: unknown) => ManifestCheck;
  /** Dossier (vide ou absent) où écrire les fichiers pendant leur contrôle. */
  readonly extractTo?: string;
}

export type VerifyResult =
  | {
      readonly ok: true;
      readonly id: string;
      readonly version: string;
      readonly keyId: string;
      readonly manifest: ManifestCore;
      /** Manifeste tel que lu (déjà validé par `checkManifest` s'il est fourni). */
      readonly rawManifest: unknown;
      readonly files: FileList['files'];
      readonly totalBytes: number;
    }
  | { readonly ok: false; readonly problem: PackageProblem; readonly detail: string };

class PackageError extends Error {
  readonly problem: PackageProblem;
  constructor(problem: PackageProblem, detail: string) {
    super(detail);
    this.problem = problem;
  }
}

function fail(problem: PackageProblem, detail: string): never {
  throw new PackageError(problem, detail);
}

// Messages de `validateFileName` de yauzl (noms absolus, `..`, barres obliques inverses).
const YAUZL_NAME_ERROR = /invalid relative path|absolute path|invalid characters in fileName/;

async function readSmall(zip: yauzl.ZipFile, entry: yauzl.Entry): Promise<Buffer> {
  if (entry.uncompressedSize > MAX_METADATA_BYTES) {
    fail('too-large', `${entry.fileName}: ${entry.uncompressedSize} octets`);
  }
  const stream = await zip.openReadStreamPromise(entry);
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function parseJson(bytes: Buffer, name: string, problem: PackageProblem): unknown {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    return fail(problem, `${name}: JSON invalide`);
  }
}

function hashing(onDigest: (digest: string) => void): Transform {
  const hash = createHash('sha256');
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk);
      callback(null, chunk);
    },
    flush(callback) {
      onDigest(hash.digest('hex'));
      callback();
    },
  });
}

async function consume(stream: Readable, hasher: Transform, target: string | null): Promise<void> {
  if (target === null) {
    const sink = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });
    await pipeline(stream, hasher, sink);
    return;
  }
  await mkdir(path.dirname(target), { recursive: true });
  await pipeline(stream, hasher, createWriteStream(target, { flags: 'wx' }));
}

async function collectEntries(zip: yauzl.ZipFile): Promise<Map<string, yauzl.Entry>> {
  const entries = new Map<string, yauzl.Entry>();
  const lowered = new Set<string>();
  try {
    for await (const entry of zip.eachEntry()) {
      const name = entry.fileName;
      if (entries.size >= MAX_ENTRIES) fail('too-large', `plus de ${MAX_ENTRIES} entrées`);
      if (name.endsWith('/')) fail('extra-entry', `dossier: ${name}`);
      if (!isSafePackagePath(name)) fail('bad-entry-name', name);
      if (entry.isEncrypted()) fail('unreadable', `entrée chiffrée: ${name}`);
      if (entries.has(name) || lowered.has(name.toLowerCase())) fail('duplicate-entry', name);
      entries.set(name, entry);
      lowered.add(name.toLowerCase());
    }
  } catch (error) {
    if (error instanceof PackageError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    fail(YAUZL_NAME_ERROR.test(message) ? 'bad-entry-name' : 'unreadable', message);
  }
  return entries;
}

function checkSignature(
  signatureBytes: Buffer,
  listBytes: Buffer,
  trustedKeys: readonly TrustedKey[],
): string {
  const parsed = v.safeParse(
    SignatureFileSchema,
    parseJson(signatureBytes, SIGNATURE_NAME, 'bad-signature'),
  );
  if (!parsed.success) fail('bad-signature', `${SIGNATURE_NAME}: format inattendu`);
  const { keyId, signature } = parsed.output;
  const trusted = trustedKeys.find((key) => key.id === keyId);
  if (trusted === undefined)
    fail('unknown-key', `clé « ${keyId} » inconnue de cette version de Duo`);
  const publicKey = publicKeyFromRaw(trusted.publicKey);
  if (publicKey === null) fail('unknown-key', `clé « ${keyId} » illisible`);
  if (!verifyBytes(listBytes, Buffer.from(signature, 'base64'), publicKey)) {
    fail('bad-signature', `signature de ${FILE_LIST_NAME} fausse (clé « ${keyId} »)`);
  }
  return keyId;
}

function checkFileList(listBytes: Buffer, entries: Map<string, yauzl.Entry>): FileList {
  const parsed = v.safeParse(FileListSchema, parseJson(listBytes, FILE_LIST_NAME, 'bad-file-list'));
  if (!parsed.success) fail('bad-file-list', `${FILE_LIST_NAME}: format inattendu`);
  const list = parsed.output;
  const listed = new Set<string>();
  let total = 0;
  for (const record of list.files) {
    if (
      !isSafePackagePath(record.path) ||
      record.path === FILE_LIST_NAME ||
      record.path === SIGNATURE_NAME
    ) {
      fail('bad-file-list', `chemin refusé: ${record.path}`);
    }
    if (listed.has(record.path)) fail('bad-file-list', `chemin en double: ${record.path}`);
    listed.add(record.path);
    total += record.size;
    const entry = entries.get(record.path);
    if (entry === undefined) fail('missing-entry', record.path);
    if (entry.uncompressedSize !== record.size) {
      fail(
        'size-mismatch',
        `${record.path}: ${entry.uncompressedSize} octets, ${record.size} listés`,
      );
    }
  }
  if (total > MAX_PACKAGE_BYTES) fail('too-large', `${total} octets, plafond ${MAX_PACKAGE_BYTES}`);
  if (!listed.has(MANIFEST_NAME)) fail('missing-entry', MANIFEST_NAME);
  for (const name of entries.keys()) {
    if (name !== FILE_LIST_NAME && name !== SIGNATURE_NAME && !listed.has(name)) {
      fail('extra-entry', name);
    }
  }
  return list;
}

export async function verifyPackage(file: string, options: VerifyOptions): Promise<VerifyResult> {
  let zip: yauzl.ZipFile | null = null;
  try {
    let size: number;
    try {
      size = (await stat(file)).size;
    } catch (error) {
      return fail('unreadable', error instanceof Error ? error.message : String(error));
    }
    // L'archive compressée ne dépasse pas, à quelques en-têtes près, la taille extraite.
    if (size > MAX_PACKAGE_BYTES + MAX_METADATA_BYTES)
      fail('too-large', `archive de ${size} octets`);
    try {
      zip = await yauzl.openPromise(file, {
        lazyEntries: true,
        autoClose: false,
        decodeStrings: true,
        validateEntrySizes: true,
        strictFileNames: true,
      });
    } catch (error) {
      return fail('unreadable', error instanceof Error ? error.message : String(error));
    }
    const entries = await collectEntries(zip);
    const listEntry = entries.get(FILE_LIST_NAME);
    const signatureEntry = entries.get(SIGNATURE_NAME);
    if (listEntry === undefined || signatureEntry === undefined) {
      fail('missing-signature', `${FILE_LIST_NAME} ou ${SIGNATURE_NAME} absent`);
    }
    const listBytes = await readSmall(zip, listEntry);
    const keyId = checkSignature(
      await readSmall(zip, signatureEntry),
      listBytes,
      options.trustedKeys,
    );
    const list = checkFileList(listBytes, entries);

    const manifestRecord = list.files.find((record) => record.path === MANIFEST_NAME);
    const manifestEntry = entries.get(MANIFEST_NAME);
    if (manifestRecord === undefined || manifestEntry === undefined) {
      fail('missing-entry', MANIFEST_NAME);
    }
    const manifestBytes = await readSmall(zip, manifestEntry);
    if (createHash('sha256').update(manifestBytes).digest('hex') !== manifestRecord.sha256) {
      fail('hash-mismatch', MANIFEST_NAME);
    }
    const rawManifest = parseJson(manifestBytes, MANIFEST_NAME, 'bad-manifest');
    const core = v.safeParse(ManifestCoreSchema, rawManifest);
    if (!core.success) fail('bad-manifest', `${MANIFEST_NAME}: champs manquants ou invalides`);
    const manifest = core.output;
    if (manifest.id !== list.id || manifest.version !== list.version) {
      fail(
        'bad-manifest',
        `manifeste ${manifest.id}@${manifest.version}, liste signée ${list.id}@${list.version}`,
      );
    }
    if (!list.files.some((record) => record.path === manifest.entry)) {
      fail('bad-manifest', `page d'entrée ${manifest.entry} absente du paquet`);
    }
    const full = options.checkManifest?.(rawManifest) ?? { ok: true };
    if (!full.ok) fail('bad-manifest', full.problems.join('; '));

    const extractTo = options.extractTo ?? null;
    let totalBytes = 0;
    for (const record of list.files) {
      const entry = entries.get(record.path);
      if (entry === undefined) fail('missing-entry', record.path);
      let digest = '';
      const stream = await zip.openReadStreamPromise(entry);
      const target = extractTo === null ? null : path.join(extractTo, ...record.path.split('/'));
      try {
        const hasher = hashing((value) => {
          digest = value;
        });
        await consume(stream, hasher, target);
      } catch (error) {
        fail(
          'unreadable',
          `${record.path}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      if (digest !== record.sha256) fail('hash-mismatch', record.path);
      totalBytes += record.size;
    }
    return {
      ok: true,
      id: list.id,
      version: list.version,
      keyId,
      manifest,
      rawManifest,
      files: list.files,
      totalBytes,
    };
  } catch (error) {
    if (error instanceof PackageError) {
      return { ok: false, problem: error.problem, detail: error.message };
    }
    return {
      ok: false,
      problem: 'unreadable',
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    zip?.close();
  }
}
