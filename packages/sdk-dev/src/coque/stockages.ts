// Stockages du navigateur: localStorage (deux vues) ou disque de la machine qui sert (réseau local).
import * as v from 'valibot';
import {
  summarizeSave,
  type HistoryEntry,
  type SaveStore,
  type SlotSummary,
  type StoredSave,
} from '../coeur/stockage';
import { SlotSummaryListSchema, StoredSaveSchema } from '../serveur/schemas.ts';

export function createLocalStorageStore(prefix = 'duo-sdk-dev'): SaveStore {
  const key = (gameId: string, slot: number): string => `${prefix}:${gameId}:sauvegarde:${slot}`;
  const read = (gameId: string, slot: number): StoredSave | null => {
    const text = localStorage.getItem(key(gameId, slot));
    if (text === null) return null;
    try {
      const result = v.safeParse(StoredSaveSchema, JSON.parse(text));
      return result.success ? result.output : null;
    } catch {
      return null;
    }
  };
  return {
    list(gameId) {
      const out: SlotSummary[] = [];
      for (let slot = 1; slot <= 10; slot++) {
        const save = read(gameId, slot);
        if (save !== null) out.push(summarizeSave(save));
      }
      return Promise.resolve(out);
    },
    read: (gameId, slot) => Promise.resolve(read(gameId, slot)),
    write(gameId, save) {
      localStorage.setItem(key(gameId, save.slot), JSON.stringify(save));
      return Promise.resolve();
    },
    appendHistory(gameId, entry: HistoryEntry) {
      const historyKey = `${prefix}:${gameId}:historique`;
      const list: unknown = JSON.parse(localStorage.getItem(historyKey) ?? '[]');
      const entries = Array.isArray(list) ? list : [];
      entries.push(entry);
      localStorage.setItem(historyKey, JSON.stringify(entries));
      return Promise.resolve();
    },
  };
}

/** Sauvegardes et historique sur le disque de la machine qui sert (`servir`). */
export function createHttpStore(base = '/api'): SaveStore {
  const check = async (response: Response): Promise<Response> => {
    if (!response.ok) throw new Error(`serveur: ${response.status} ${await response.text()}`);
    return response;
  };
  return {
    async list() {
      const response = await check(await fetch(`${base}/sauvegardes`));
      const result = v.safeParse(SlotSummaryListSchema, await response.json());
      return result.success ? result.output : [];
    },
    async read(_gameId, slot) {
      const response = await fetch(`${base}/sauvegardes/${slot}`);
      if (response.status === 404) return null;
      await check(response);
      const result = v.safeParse(StoredSaveSchema, await response.json());
      return result.success ? result.output : null;
    },
    async write(_gameId, save) {
      await check(
        await fetch(`${base}/sauvegardes/${save.slot}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(save),
        }),
      );
    },
    async appendHistory(_gameId, entry) {
      await check(
        await fetch(`${base}/historique`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(entry),
        }),
      );
    },
  };
}
