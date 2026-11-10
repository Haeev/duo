/**
 * Réglages du joueur: un volume par catégorie, un volume général et la coupure. Le volume général
 * de la plateforme (SDK) s'applique par-dessus; ceux-ci sont propres au jeu (onglet des réglages).
 */
import * as v from 'valibot';
import type { Category, Tuning } from './schemas';

const Level = v.pipe(v.number(), v.minValue(0), v.maxValue(1));
const SettingsSchema = v.strictObject({
  master: Level,
  effects: Level,
  interface: Level,
  babble: Level,
  ambience: Level,
  muted: v.boolean(),
});
export type AudioSettings = v.InferOutput<typeof SettingsSchema>;

export function defaultSettings(tuning: Tuning): AudioSettings {
  return { ...tuning.defaults, muted: false };
}

export function categoryGain(settings: AudioSettings, category: Category): number {
  return settings.muted ? 0 : settings.master * settings[category];
}

/** Lit les réglages enregistrés; une valeur absente ou abîmée redonne les réglages par défaut. */
export function loadSettings(
  tuning: Tuning,
  storage: Pick<Storage, 'getItem'> | null,
): AudioSettings {
  const fallback = defaultSettings(tuning);
  if (storage === null) return fallback;
  try {
    const text = storage.getItem(tuning.storageKey);
    if (text === null) return fallback;
    const result = v.safeParse(SettingsSchema, JSON.parse(text) as unknown);
    return result.success ? result.output : fallback;
  } catch {
    return fallback;
  }
}

export function saveSettings(
  tuning: Tuning,
  storage: Pick<Storage, 'setItem'> | null,
  settings: AudioSettings,
): void {
  try {
    storage?.setItem(tuning.storageKey, JSON.stringify(settings));
  } catch {
    // Stockage plein ou refusé: les réglages valent pour la séance seulement.
  }
}
