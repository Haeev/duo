/**
 * Réglages propres à chaque joueur (ux 8.10): gardés sur cette machine, jamais envoyés à
 * l'autre. Stockage local en attendant l'ADR sur les réglages par joueur (technique R11,
 * question U1): une valeur illisible reprend son défaut, rien ne casse.
 */
import { v } from '@duo/sdk';

const SettingsSchema = v.object({
  fovDeg: v.optional(v.pipe(v.number(), v.minValue(50), v.maxValue(75)), 60),
  headBob: v.optional(v.picklist(['off', 'light']), 'off'),
  crosshair: v.optional(v.picklist(['small', 'medium', 'large']), 'medium'),
  aimAssist: v.optional(v.picklist(['none', 'light', 'strong']), 'light'),
  sensitivity: v.optional(v.pipe(v.number(), v.minValue(0.2), v.maxValue(3)), 1),
  invertY: v.optional(v.boolean(), false),
  simplifiedGestures: v.optional(v.boolean(), false),
  optionReminder: v.optional(v.boolean(), false),
  stationGuide: v.optional(v.boolean(), false),
  holdMode: v.optional(v.picklist(['hold', 'toggle']), 'hold'),
  fastMode: v.optional(v.picklist(['hold', 'toggle']), 'hold'),
  ambience: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(100)), 80),
  headphones: v.optional(v.boolean(), false),
  handwriting: v.optional(v.picklist(['handwritten', 'readable']), 'handwritten'),
  soundCues: v.optional(v.boolean(), true),
  clockDisplay: v.optional(v.picklist(['always', 'service', 'never']), 'always'),
  tips: v.optional(v.boolean(), true),
  textSize: v.optional(v.picklist(['normal', 'large', 'larger']), 'normal'),
  showFps: v.optional(v.boolean(), false),
});

export type PlayerSettings = v.InferOutput<typeof SettingsSchema>;
export type SettingKey = keyof PlayerSettings;

export const DEFAULT_SETTINGS: PlayerSettings = v.parse(SettingsSchema, {});

/** Facteur de la taille des textes, par-dessus la taille d'interface de Duo. */
export const TEXT_SCALE: Readonly<Record<PlayerSettings['textSize'], number>> = {
  normal: 1,
  large: 1.15,
  larger: 1.3,
};

/** Champ horizontal vu sur cet écran pour un champ vertical donné (ux 8.1). */
export function horizontalFov(verticalDeg: number, aspect: number): number {
  const half = (verticalDeg * Math.PI) / 360;
  return Math.round((2 * Math.atan(Math.tan(half) * aspect) * 180) / Math.PI);
}

export interface SettingsStore {
  get(): PlayerSettings;
  set<K extends SettingKey>(key: K, value: PlayerSettings[K]): void;
  onChange(listener: (settings: PlayerSettings) => void): () => void;
}

const STORAGE_KEY = 'deux-tabliers.reglages.v1';

function readStored(): PlayerSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_SETTINGS;
    const parsed = v.safeParse(SettingsSchema, JSON.parse(raw));
    return parsed.success ? parsed.output : DEFAULT_SETTINGS;
  } catch {
    // Stockage refusé ou contenu illisible: les défauts suffisent.
    return DEFAULT_SETTINGS;
  }
}

export function createSettingsStore(initial?: Partial<PlayerSettings>): SettingsStore {
  let settings: PlayerSettings = { ...readStored(), ...initial };
  const listeners = new Set<(settings: PlayerSettings) => void>();
  return {
    get: () => settings,
    set(key, value) {
      settings = { ...settings, [key]: value };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch {
        // Sans stockage, le réglage vaut pour la séance.
      }
      for (const l of listeners) l(settings);
    },
    onChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
