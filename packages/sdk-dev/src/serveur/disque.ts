// Sauvegardes et historique du mode réseau local, sur le disque de la machine qui sert.
// Écriture sûre (ADR 0009, point 4, simplifié): fichier temporaire, fsync, copie de l'ancien, renommage.
import { mkdir, open, readdir, readFile, rename, copyFile, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as v from 'valibot';
import { summarizeSave } from '../coeur/stockage.ts';
import { StoredSaveSchema } from './schemas.ts';

export type DiskSave = v.InferOutput<typeof StoredSaveSchema>;

const RETRYABLE = new Set(['EPERM', 'EBUSY', 'EACCES']);

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : undefined;
}

async function retry<T>(action: () => Promise<T>): Promise<T> {
  // Sous Windows, un antivirus ou l'indexeur tient parfois le fichier un instant.
  for (let attempt = 0; ; attempt++) {
    try {
      return await action();
    } catch (error) {
      if (attempt >= 10 || !RETRYABLE.has(errorCode(error) ?? '')) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

async function writeAtomic(path: string, content: string): Promise<void> {
  const temporary = `${path}.tmp`;
  const handle = await open(temporary, 'w');
  try {
    await handle.writeFile(content, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await copyFile(path, `${path}.bak`);
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') throw error;
  }
  await retry(() => rename(temporary, path));
}

export interface DiskStore {
  readonly directory: string;
  list(): Promise<Omit<DiskSave, 'data'>[]>;
  read(slot: number): Promise<DiskSave | null>;
  write(save: DiskSave): Promise<void>;
  appendHistory(entry: unknown): Promise<void>;
}

export function createDiskStore(directory: string): DiskStore {
  const savesDir = join(directory, 'sauvegardes');
  const slotFile = (slot: number): string => join(savesDir, `emplacement-${slot}.json`);

  const read = async (slot: number): Promise<DiskSave | null> => {
    for (const path of [slotFile(slot), `${slotFile(slot)}.bak`]) {
      try {
        const result = v.safeParse(StoredSaveSchema, JSON.parse(await readFile(path, 'utf8')));
        if (result.success) return result.output;
      } catch (error) {
        if (errorCode(error) !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
      }
    }
    return null;
  };

  return {
    directory,
    async list() {
      let names: string[];
      try {
        names = await readdir(savesDir);
      } catch (error) {
        if (errorCode(error) === 'ENOENT') return [];
        throw error;
      }
      const slots = names
        .map((name) => /^emplacement-(\d+)\.json$/.exec(name)?.[1])
        .filter((slot): slot is string => slot !== undefined)
        .map(Number)
        .sort((a, b) => a - b);
      const out: Omit<DiskSave, 'data'>[] = [];
      for (const slot of slots) {
        const save = await read(slot);
        if (save !== null) out.push(summarizeSave(save));
      }
      return out;
    },
    read,
    async write(save) {
      await mkdir(savesDir, { recursive: true });
      await writeAtomic(slotFile(save.slot), JSON.stringify(save));
    },
    async appendHistory(entry) {
      await mkdir(directory, { recursive: true });
      await appendFile(join(directory, 'historique.jsonl'), `${JSON.stringify(entry)}\n`, 'utf8');
    },
  };
}
