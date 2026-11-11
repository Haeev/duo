/**
 * Réglages gardés d'une séance à l'autre, sur la machine du joueur (`localStorage`), et envoi du
 * cran d'aide à l'hôte. Ce qui est lu est validé: une valeur absente ou abîmée reprend le défaut.
 */
import * as v from 'valibot';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import { AssistLevelSchema, type AssistLevel } from '../../etat/joueur';
import type { ReadonlyWorld } from '../../etat/monde';
import { assistLevelOf } from '../../simulation/aide/index';
import type { Intent } from '../../simulation/noyau/entrees';
import type { UiSettings } from './lectures';

export interface SettingsMemoryTuning {
  readonly storageKey: string;
  /** Écart persistant entre le cran voulu et celui de l'hôte: on renvoie au plus toutes les N ms. */
  readonly resendMs: number;
}

export const SETTINGS_MEMORY: SettingsMemoryTuning = {
  storageKey: 'la-petite-ligne-2.reglages',
  resendMs: 1000,
};

/** Le peu de stockage dont on a besoin (`localStorage` en jeu, une table en test). */
export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Chaque champ est facultatif (réglage ajouté depuis); un champ abîmé fait reprendre les défauts. */
const StoredSchema = v.object({
  volume: v.exactOptional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(100))),
  needsAlways: v.exactOptional(v.boolean()),
  scale: v.exactOptional(v.picklist(['normal', 'large', 'xlarge'])),
  reducedMotion: v.exactOptional(v.boolean()),
  toolbarAlways: v.exactOptional(v.boolean()),
  shake: v.exactOptional(v.boolean()),
  assist: v.exactOptional(AssistLevelSchema),
});

/** Réglages gardés, champ par champ par-dessus `fallback`. */
export function loadUiSettings(storage: SettingsStorage | null, fallback: UiSettings): UiSettings {
  let raw: unknown;
  try {
    const text = storage?.getItem(SETTINGS_MEMORY.storageKey) ?? null;
    raw = text === null ? null : JSON.parse(text);
  } catch {
    // Stockage refusé ou texte abîmé: les défauts.
    return fallback;
  }
  const parsed = v.safeParse(StoredSchema, raw);
  if (!parsed.success) return fallback;
  // Un champ absent (réglage ajouté depuis) garde son défaut.
  return { ...fallback, ...parsed.output };
}

export function saveUiSettings(storage: SettingsStorage | null, ui: UiSettings): void {
  try {
    storage?.setItem(SETTINGS_MEMORY.storageKey, JSON.stringify(ui));
  } catch {
    // Stockage plein ou refusé: le réglage vaut pour cette séance.
  }
}

/**
 * Envoi du cran d'aide: tant que l'état de l'hôte ne porte pas le cran voulu, on le redit (au
 * départ, après un changement, après une reprise de partie), au plus toutes les `resendMs`.
 */
export function createAssistSync(tuning: SettingsMemoryTuning = SETTINGS_MEMORY): {
  frame(nowMs: number, world: ReadonlyWorld, me: PlayerIndex, wanted: AssistLevel): Intent | null;
} {
  let sent: AssistLevel | null = null;
  let sentAt = Number.NEGATIVE_INFINITY;
  return {
    frame(nowMs, world, me, wanted) {
      if (assistLevelOf(world, me) === wanted) return null;
      if (sent === wanted && nowMs - sentAt < tuning.resendMs) return null;
      sent = wanted;
      sentAt = nowMs;
      return { type: 'set_assist', level: wanted };
    },
  };
}
