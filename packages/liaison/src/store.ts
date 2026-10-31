import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as v from 'valibot';

/**
 * Mémoire de la liaison, propre à la machine et jamais répliquée (reseau.md,
 * section 6.3): clés des duos et adresses retenues du partenaire. Le principal la
 * range dans `<userData>/reseau.json`; la clé est un secret de la machine.
 */

const PairingSchema = v.object({
  duo: v.pipe(v.string(), v.regex(/^[0-9a-f]{32}$/)),
  partner: v.pipe(v.string(), v.regex(/^[A-Za-z0-9-]{8,64}$/)),
  key: v.pipe(v.string(), v.regex(/^[A-Za-z0-9_-]{43}$/)),
  createdAt: v.pipe(v.string(), v.maxLength(40)),
});
export type PairingRecord = v.InferOutput<typeof PairingSchema>;

const RetainedAddressSchema = v.object({
  host: v.pipe(v.string(), v.regex(/^\d{1,3}(?:\.\d{1,3}){3}$/)),
  port: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(65_535)),
  partner: v.nullable(v.pipe(v.string(), v.regex(/^[A-Za-z0-9-]{8,64}$/))),
  lastSuccessAt: v.pipe(v.string(), v.maxLength(40)),
});
export type RetainedAddress = v.InferOutput<typeof RetainedAddressSchema>;

const MemorySchema = v.object({
  format: v.literal(1),
  pairings: v.pipe(v.array(PairingSchema), v.maxLength(16)),
  addresses: v.pipe(v.array(RetainedAddressSchema), v.maxLength(16)),
});

export interface LinkMemory {
  readonly pairings: readonly PairingRecord[];
  readonly addresses: readonly RetainedAddress[];
}

export const EMPTY_MEMORY: LinkMemory = { pairings: [], addresses: [] };

/** Rangement de la mémoire: en mémoire vive (tests, démonstration) ou dans un fichier. */
export interface LinkStore {
  load(): Promise<LinkMemory>;
  save(memory: LinkMemory): Promise<void>;
}

export function createMemoryStore(initial: LinkMemory = EMPTY_MEMORY): LinkStore & { current(): LinkMemory } {
  let memory = initial;
  return {
    load: () => Promise.resolve(memory),
    save: (next) => {
      memory = next;
      return Promise.resolve();
    },
    current: () => memory,
  };
}

/**
 * Fichier JSON validé à la lecture; écriture atomique (fichier temporaire puis
 * renommage), droits restreints au compte. Un fichier illisible vaut une mémoire
 * vide: on reforme le duo plutôt que de bloquer la soirée.
 */
export function createFileStore(filePath: string): LinkStore {
  let chain: Promise<void> = Promise.resolve();
  return {
    load: async () => {
      try {
        const content = await readFile(filePath, 'utf8');
        const parsed = v.safeParse(MemorySchema, JSON.parse(content));
        return parsed.success
          ? { pairings: parsed.output.pairings, addresses: parsed.output.addresses }
          : EMPTY_MEMORY;
      } catch {
        return EMPTY_MEMORY;
      }
    },
    save: (memory) => {
      const write = async (): Promise<void> => {
        await mkdir(path.dirname(filePath), { recursive: true });
        const temporary = `${filePath}.tmp`;
        const content = JSON.stringify(
          { format: 1, pairings: memory.pairings, addresses: memory.addresses },
          null,
          2,
        );
        await writeFile(temporary, content, { encoding: 'utf8', mode: 0o600 });
        await chmod(temporary, 0o600);
        await rename(temporary, filePath);
      };
      chain = chain.then(write, write);
      return chain;
    },
  };
}

const MAX_ADDRESSES = 8;

/** Retient une adresse qui a marché, la plus récente en tête. */
export function withRetainedAddress(memory: LinkMemory, address: RetainedAddress): LinkMemory {
  const others = memory.addresses.filter(
    (entry) => !(entry.host === address.host && entry.port === address.port),
  );
  return { ...memory, addresses: [address, ...others].slice(0, MAX_ADDRESSES) };
}

export function withPairing(memory: LinkMemory, pairing: PairingRecord): LinkMemory {
  const others = memory.pairings.filter((entry) => entry.duo !== pairing.duo);
  return { ...memory, pairings: [pairing, ...others].slice(0, 16) };
}
