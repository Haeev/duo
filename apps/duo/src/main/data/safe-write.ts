// Écriture sûre (ADR 0009, point 4): fichier temporaire, fsync, copie de
// secours `.bak`, renommage atomique. Une file par fichier: jamais deux
// écritures concurrentes du même fichier. Reprises courtes sur les erreurs
// passagères de Windows (antivirus, indexeur).
import { constants } from 'node:fs';
import { copyFile, mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import * as v from 'valibot';

const TRANSIENT_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);
const RETRY_WINDOW_MS = 1000;
const RETRY_STEP_MS = 50;

const queues = new Map<string, Promise<unknown>>();

function errorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetries<T>(operation: () => Promise<T>): Promise<T> {
  const deadline = Date.now() + RETRY_WINDOW_MS;
  for (;;) {
    try {
      return await operation();
    } catch (error) {
      const code = errorCode(error);
      if (code === undefined || !TRANSIENT_CODES.has(code) || Date.now() >= deadline) {
        throw error;
      }
      await delay(RETRY_STEP_MS);
    }
  }
}

function enqueue<T>(file: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(file) ?? Promise.resolve();
  const next = previous.then(task, task);
  const settled = next.catch(() => undefined);
  queues.set(file, settled);
  void settled.then(() => {
    if (queues.get(file) === settled) queues.delete(file);
  });
  return next;
}

export interface SafeWriteOptions {
  /** Copier la version actuelle en `.bak` avant de la remplacer (petits fichiers mutables). */
  readonly backup: boolean;
}

/** Écrit `data` dans `file` sans jamais laisser un fichier à moitié écrit. */
export function writeFileSafe(
  file: string,
  data: string | Uint8Array,
  options: SafeWriteOptions,
): Promise<void> {
  return enqueue(file, async () => {
    await mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.tmp`;
    const handle = await withRetries(() => open(temporary, 'w'));
    try {
      await handle.writeFile(data);
      await handle.sync();
    } finally {
      await handle.close();
    }
    if (options.backup) {
      try {
        await withRetries(() => copyFile(file, `${file}.bak`, constants.COPYFILE_FICLONE));
      } catch (error) {
        if (errorCode(error) !== 'ENOENT') throw error;
      }
    }
    await withRetries(() => rename(temporary, file));
  });
}

export function writeJsonSafe(file: string, value: unknown): Promise<void> {
  return writeFileSafe(file, `${JSON.stringify(value, null, 2)}\n`, { backup: true });
}

export type JsonRead<T> =
  | { readonly status: 'ok'; readonly value: T; readonly from: 'file' | 'backup' }
  | { readonly status: 'missing' }
  | { readonly status: 'invalid'; readonly quarantined: string | null };

async function tryRead<T>(
  file: string,
  schema: v.GenericSchema<unknown, T>,
): Promise<{ kind: 'ok'; value: T } | { kind: 'missing' } | { kind: 'invalid' }> {
  let text: string;
  try {
    text = await withRetries(() => readFile(file, 'utf8'));
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return { kind: 'missing' };
    throw error;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { kind: 'invalid' };
  }
  const parsed = v.safeParse(schema, raw);
  return parsed.success ? { kind: 'ok', value: parsed.output } : { kind: 'invalid' };
}

/**
 * Lit un fichier JSON validé par son schéma (ADR 0009, point 5). Fichier
 * abîmé: on essaie `.bak`; le fichier abîmé est gardé à part, jamais effacé.
 */
export async function readJsonSafe<T>(
  file: string,
  schema: v.GenericSchema<unknown, T>,
  now: Date = new Date(),
): Promise<JsonRead<T>> {
  const main = await tryRead(file, schema);
  if (main.kind === 'ok') return { status: 'ok', value: main.value, from: 'file' };
  const backup = await tryRead(`${file}.bak`, schema);
  let quarantined: string | null = null;
  if (main.kind === 'invalid') {
    quarantined = `${file}.abime-${now.toISOString().replace(/[:.]/g, '-')}`;
    await withRetries(() => rename(file, quarantined ?? file));
  }
  if (backup.kind === 'ok') {
    await writeJsonSafe(file, backup.value);
    return { status: 'ok', value: backup.value, from: 'backup' };
  }
  if (main.kind === 'missing' && backup.kind === 'missing') return { status: 'missing' };
  return { status: 'invalid', quarantined };
}

/** Supprime un fichier s'il existe (tests et ménage). */
export async function removeFile(file: string): Promise<void> {
  await rm(file, { force: true });
}
