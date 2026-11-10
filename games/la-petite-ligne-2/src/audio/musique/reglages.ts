/**
 * Réglage de la musique, séparé de ceux des effets, de l'interface, du babil et de l'ambiance
 * (`../reglages.ts`): un volume propre, la coupure, enregistrés sous leur propre clé.
 */
import * as v from 'valibot';
import type { MusicTable } from './schemas';

const Level = v.pipe(v.number(), v.minValue(0), v.maxValue(1));
const MusicSettingsSchema = v.strictObject({ music: Level, muted: v.boolean() });
export type MusicSettings = v.InferOutput<typeof MusicSettingsSchema>;

export function defaultMusicSettings(table: MusicTable): MusicSettings {
  return { music: table.defaults.music, muted: false };
}

/** Lit le réglage enregistré; une valeur absente ou abîmée redonne le réglage par défaut. */
export function loadMusicSettings(
  table: MusicTable,
  storage: Pick<Storage, 'getItem'> | null,
): MusicSettings {
  const fallback = defaultMusicSettings(table);
  if (storage === null) return fallback;
  try {
    const text = storage.getItem(table.storageKey);
    if (text === null) return fallback;
    const result = v.safeParse(MusicSettingsSchema, JSON.parse(text) as unknown);
    return result.success ? result.output : fallback;
  } catch {
    return fallback;
  }
}

export function saveMusicSettings(
  table: MusicTable,
  storage: Pick<Storage, 'setItem'> | null,
  settings: MusicSettings,
): void {
  try {
    storage?.setItem(table.storageKey, JSON.stringify(settings));
  } catch {
    // Stockage plein ou refusé: le réglage reste valable pour la séance.
  }
}
