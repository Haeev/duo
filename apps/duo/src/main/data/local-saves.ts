// Sauvegardes du prototype: un emplacement par jeu, sur la machine qui héberge,
// sans réplication (le lot L9 apporte les duos, les révisions répliquées et les
// copies de secours de l'ADR 0009). Même principe dès maintenant: une révision
// immuable nommée par son empreinte, puis une tête écrite en sûreté.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as v from 'valibot';
import type { SaveSummary } from '../../shared/state';
import { readJsonSafe, writeFileSafe, writeJsonSafe } from './safe-write';

/** Plafond de la plateforme par emplacement (ADR 0009, point 3). */
export const PLATFORM_MAX_SAVE_BYTES = 33_554_432;

const HeadSchema = v.object({
  schema: v.literal(1),
  revision: v.pipe(v.number(), v.integer(), v.minValue(1)),
  sha256: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/)),
  label: v.pipe(v.string(), v.maxLength(80)),
  dataSchema: v.pipe(v.number(), v.integer(), v.minValue(0)),
  gameVersion: v.string(),
  size: v.pipe(v.number(), v.integer(), v.minValue(0)),
  writtenAt: v.string(),
  previous: v.array(v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/))),
});

type Head = v.InferOutput<typeof HeadSchema>;

export interface StoredSave {
  readonly summary: SaveSummary;
  readonly dataSchema: number;
  readonly data: Uint8Array;
}

export interface SaveWrite {
  readonly label: string;
  readonly dataSchema: number;
  readonly gameVersion: string;
  readonly data: Uint8Array;
}

export class LocalSaves {
  constructor(private readonly dir: string) {}

  private slotDir(gameId: string): string {
    return path.join(this.dir, 'sauvegardes-locales', gameId, '1');
  }

  async readHead(gameId: string): Promise<Head | null> {
    const head = await readJsonSafe(path.join(this.slotDir(gameId), 'head.json'), HeadSchema);
    return head.status === 'ok' ? head.value : null;
  }

  async summary(gameId: string): Promise<SaveSummary | null> {
    const head = await this.readHead(gameId);
    return head === null ? null : { label: head.label, writtenAt: Date.parse(head.writtenAt) };
  }

  /** Lit la révision courante; `null` si absente ou si son empreinte ne correspond pas. */
  async read(gameId: string): Promise<StoredSave | null> {
    const head = await this.readHead(gameId);
    if (head === null) return null;
    let data: Buffer;
    try {
      data = await readFile(path.join(this.slotDir(gameId), `${head.sha256}.json`));
    } catch {
      return null;
    }
    const sha256 = createHash('sha256').update(data).digest('hex');
    if (sha256 !== head.sha256) return null;
    return {
      summary: { label: head.label, writtenAt: Date.parse(head.writtenAt) },
      dataSchema: head.dataSchema,
      data: new Uint8Array(data),
    };
  }

  async write(gameId: string, save: SaveWrite, now: Date = new Date()): Promise<void> {
    const sha256 = createHash('sha256').update(save.data).digest('hex');
    const previous = await this.readHead(gameId);
    if (previous?.sha256 === sha256) return;
    const dir = this.slotDir(gameId);
    await writeFileSafe(path.join(dir, `${sha256}.json`), save.data, { backup: false });
    const head: Head = {
      schema: 1,
      revision: (previous?.revision ?? 0) + 1,
      sha256,
      label: save.label,
      dataSchema: save.dataSchema,
      gameVersion: save.gameVersion,
      size: save.data.byteLength,
      writtenAt: now.toISOString(),
      previous:
        previous === null ? [] : [previous.sha256, ...previous.previous].slice(0, 3),
    };
    await writeJsonSafe(path.join(dir, 'head.json'), head);
  }
}
