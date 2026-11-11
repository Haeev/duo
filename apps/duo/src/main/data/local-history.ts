// Historique du prototype (ADR 0009, point 8, en attendant les duos et la réplication du
// lot L9): une entrée par partie ou séance, écrite sur chacune des deux machines par sa
// propre plateforme d'après la fin décidée par l'hôte (même identifiant, même contenu).
// Un fichier par entrée, nommé par l'heure de fin puis l'identifiant de partie: l'ordre
// des noms est l'ordre chronologique, et la fiche d'un jeu ne lit que ses dernières entrées.
// Une entrée n'est réécrite qu'une fois au plus, quand le résumé du jeu arrive après la fin.
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import * as v from 'valibot';
import { readJsonSafe, writeFileSafe } from './safe-write';

/** Limites du pont (ADR 0005): trois statistiques, libellé de 32 caractères, valeur de 16. */
export const HISTORY_LIMITS = { stats: 3, label: 32, value: 16 } as const;

const GameIdSchema = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]{1,31}$/));
/** Identifiant de partie reçu de la liaison: il entre dans un nom de fichier, d'où ce filtre. */
const MatchIdSchema = v.pipe(v.string(), v.regex(/^[A-Za-z0-9-]{1,64}$/));

export const HistoryStatSchema = v.object({
  label: v.pipe(v.string(), v.minLength(1), v.maxLength(HISTORY_LIMITS.label)),
  value: v.pipe(v.string(), v.maxLength(HISTORY_LIMITS.value)),
});

export const HistoryEntrySchema = v.object({
  schema: v.literal(1),
  matchId: MatchIdSchema,
  gameId: GameIdSchema,
  gameVersion: v.pipe(v.string(), v.maxLength(32)),
  play: v.picklist(['match', 'session']),
  /** Place de cette machine pendant la partie. */
  role: v.picklist(['host', 'guest']),
  endedAt: v.pipe(v.string(), v.isoTimestamp()),
  /** Temps joué hors pauses (horloge de l'hôte). */
  durationMs: v.pipe(v.number(), v.minValue(0)),
  reason: v.picklist(['stopped', 'crash', 'end', 'guest-gone']),
  outcome: v.nullable(v.picklist(['success', 'failure', 'draw', 'win-host', 'win-guest'])),
  progress: v.nullable(v.pipe(v.number(), v.minValue(0), v.maxValue(1))),
  stats: v.pipe(v.array(HistoryStatSchema), v.maxLength(HISTORY_LIMITS.stats)),
});

export type HistoryEntry = v.InferOutput<typeof HistoryEntrySchema>;

const FILE_PATTERN = /^\d{8}T\d{6}Z-[A-Za-z0-9-]{1,64}\.json$/;

/** `2026-11-11T19:55:04.120Z` donne `20261111T195504Z`. */
function compactTime(iso: string): string {
  return iso.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

export class LocalHistory {
  /** Fichier de chaque entrée écrite pendant cette exécution, pour la compléter au même endroit. */
  private readonly files = new Map<string, string>();

  constructor(private readonly dir: string) {}

  private gameDir(gameId: string): string {
    return path.join(this.dir, 'historique-local', gameId);
  }

  /** Écrit (ou complète) une entrée; une entrée hors schéma est refusée. */
  async record(entry: HistoryEntry): Promise<void> {
    const checked = v.parse(HistoryEntrySchema, entry);
    const key = `${checked.gameId}/${checked.matchId}`;
    const file =
      this.files.get(key) ??
      path.join(
        this.gameDir(checked.gameId),
        `${compactTime(checked.endedAt)}-${checked.matchId}.json`,
      );
    this.files.set(key, file);
    await writeFileSafe(file, `${JSON.stringify(checked, null, 2)}\n`, { backup: false });
  }

  /** Les `limit` dernières entrées d'un jeu, la plus récente d'abord; un fichier abîmé est passé. */
  async recent(gameId: string, limit: number): Promise<HistoryEntry[]> {
    if (!v.is(GameIdSchema, gameId) || limit <= 0) return [];
    let names: string[];
    try {
      names = await readdir(this.gameDir(gameId));
    } catch {
      return [];
    }
    const files = names
      .filter((name) => FILE_PATTERN.test(name))
      .sort()
      .reverse();
    const entries: HistoryEntry[] = [];
    for (const name of files) {
      if (entries.length >= limit) break;
      const read = await readJsonSafe(path.join(this.gameDir(gameId), name), HistoryEntrySchema);
      if (read.status === 'ok' && read.value.gameId === gameId) entries.push(read.value);
    }
    return entries;
  }
}
