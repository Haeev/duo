// Formats des sauvegardes et de l'historique du faux hôte, partagés par le serveur et les pages.
import * as v from 'valibot';

/** Plafond d'une sauvegarde (ADR 0009), plus la marge de son enveloppe JSON. */
export const MAX_SAVE_BODY_BYTES = 34 * 1024 * 1024;

export const StoredSaveSchema = v.object({
  slot: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(10)),
  label: v.pipe(v.string(), v.maxLength(40)),
  progress: v.exactOptional(v.pipe(v.number(), v.minValue(0), v.maxValue(1))),
  dataSchema: v.pipe(v.number(), v.integer(), v.minValue(1)),
  gameVersion: v.pipe(v.string(), v.maxLength(32)),
  moment: v.pipe(v.string(), v.maxLength(16)),
  savedAt: v.pipe(v.string(), v.maxLength(40)),
  data: v.string(),
});

export const SlotSummaryListSchema = v.array(v.omit(StoredSaveSchema, ['data']));

export const HistoryEntrySchema = v.object({
  id: v.pipe(v.string(), v.maxLength(64)),
  gameId: v.pipe(v.string(), v.maxLength(32)),
  gameVersion: v.pipe(v.string(), v.maxLength(32)),
  play: v.picklist(['match', 'session']),
  startedAt: v.pipe(v.string(), v.maxLength(40)),
  playedMs: v.pipe(v.number(), v.minValue(0)),
  players: v.pipe(
    v.array(
      v.object({
        id: v.pipe(v.string(), v.maxLength(64)),
        name: v.pipe(v.string(), v.maxLength(64)),
        role: v.string(),
      }),
    ),
    v.maxLength(2),
  ),
  outcome: v.pipe(v.string(), v.maxLength(64)),
  progress: v.exactOptional(v.number()),
  stats: v.pipe(v.array(v.object({ label: v.string(), value: v.string() })), v.maxLength(3)),
});
