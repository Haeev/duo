// Stockage des sauvegardes et de l'historique du faux hôte (mémoire, navigateur, ou disque par le serveur).

/** Une sauvegarde enregistrée: les octets JSON du jeu, tels quels, et leur fiche. */
export interface StoredSave {
  readonly slot: number;
  readonly label: string;
  readonly progress?: number;
  readonly dataSchema: number;
  readonly gameVersion: string;
  readonly moment: string;
  readonly savedAt: string;
  /** Texte JSON écrit par le jeu. */
  readonly data: string;
}

export type SlotSummary = Omit<StoredSave, 'data'>;

/** Fiche d'une sauvegarde, sans ses données. */
export function summarizeSave(save: StoredSave): SlotSummary {
  return {
    slot: save.slot,
    label: save.label,
    dataSchema: save.dataSchema,
    gameVersion: save.gameVersion,
    moment: save.moment,
    savedAt: save.savedAt,
    ...(save.progress === undefined ? {} : { progress: save.progress }),
  };
}

/** Entrée de l'historique: une partie ou une séance (ADR 0009, point 8, simplifié). */
export interface HistoryEntry {
  readonly id: string;
  readonly gameId: string;
  readonly gameVersion: string;
  readonly play: 'match' | 'session';
  readonly startedAt: string;
  readonly playedMs: number;
  readonly players: readonly {
    readonly id: string;
    readonly name: string;
    readonly role: string;
  }[];
  readonly outcome: string;
  readonly progress?: number;
  readonly stats: readonly { readonly label: string; readonly value: string }[];
}

export interface SaveStore {
  list(gameId: string): Promise<SlotSummary[]>;
  read(gameId: string, slot: number): Promise<StoredSave | null>;
  write(gameId: string, save: StoredSave): Promise<void>;
  appendHistory(gameId: string, entry: HistoryEntry): Promise<void>;
}

export function createMemoryStore(): SaveStore & { readonly history: HistoryEntry[] } {
  const saves = new Map<string, StoredSave>();
  const history: HistoryEntry[] = [];
  return {
    history,
    list(gameId) {
      return Promise.resolve(
        [...saves.entries()]
          .filter(([key]) => key.startsWith(`${gameId}/`))
          .map(([, save]) => summarizeSave(save))
          .sort((x, y) => x.slot - y.slot),
      );
    },
    read(gameId, slot) {
      return Promise.resolve(saves.get(`${gameId}/${slot}`) ?? null);
    },
    write(gameId, save) {
      saves.set(`${gameId}/${save.slot}`, save);
      return Promise.resolve();
    },
    appendHistory(_gameId, entry) {
      history.push(entry);
      return Promise.resolve();
    },
  };
}
