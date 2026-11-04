/**
 * Options graphiques d'une machine (0.13, panneau « Options » du carnet): contrat commun au rendu
 * (`rendu/options-graphiques.ts`, qui les applique), à l'interface (qui les modifie) et à `main.ts`
 * (qui les mémorise). Logique pure: lecture tolérante, niveaux d'un préréglage, cran inférieur.
 *
 * Rien ne passe par le réseau: chacun règle sa machine, l'image de l'autre ne change pas.
 */

/** Ombres du soleil: aucune, douces (carte d'ombre de base), fines (carte haute résolution). */
export type ShadowLevel = 'off' | 'soft' | 'fine';
/** Netteté: réduite (sous le pixel de l'écran), standard (budget de la plateforme), maximale (Retina). */
export type ResolutionLevel = 'reduced' | 'standard' | 'max';
/** Particules des retours visuels (mottes, gouttes, copeaux...). */
export type EffectsLevel = 'reduced' | 'full';

export interface GraphicsLevels {
  readonly shadows: ShadowLevel;
  readonly resolution: ResolutionLevel;
  readonly effects: EffectsLevel;
}

/** `auto`: qualité adaptative de `rendu/qualite.ts`; `custom`: réglages fins changés à la main. */
export type GraphicsPreset = 'auto' | 'high' | 'medium' | 'low' | 'custom';
export type FixedPreset = 'high' | 'medium' | 'low';

export interface GraphicsOptions {
  readonly preset: GraphicsPreset;
  /** Réglages fins du préréglage personnalisé (lus seulement quand `preset` vaut `custom`). */
  readonly custom: GraphicsLevels;
  /** Aucun repli automatique (préréglages choisis à la main seulement). */
  readonly neverReduce: boolean;
}

/**
 * Réglages (game designer, technical artist): les niveaux de chaque préréglage. Haute: ombres fines
 * et pleine netteté Retina (le M1 les tient); Moyenne: l'image de la 0.12, sans adaptation; Basse:
 * sans ombres, image un peu réduite, moins de particules (UHD 620 à la peine). Ce que valent ces
 * niveaux en pixels et en texels: `rendu/reglages-graphiques.ts`.
 */
export const GRAPHICS_PRESETS: Readonly<Record<FixedPreset, GraphicsLevels>> = {
  high: { shadows: 'fine', resolution: 'max', effects: 'full' },
  medium: { shadows: 'soft', resolution: 'standard', effects: 'full' },
  low: { shadows: 'off', resolution: 'reduced', effects: 'reduced' },
};

/** Préréglages dans l'ordre du panneau. */
export const GRAPHICS_PRESET_ORDER: readonly GraphicsPreset[] = [
  'auto',
  'high',
  'medium',
  'low',
  'custom',
];
export const SHADOW_LEVELS: readonly ShadowLevel[] = ['off', 'soft', 'fine'];
export const RESOLUTION_LEVELS: readonly ResolutionLevel[] = ['reduced', 'standard', 'max'];
export const EFFECTS_LEVELS: readonly EffectsLevel[] = ['reduced', 'full'];

/**
 * Filet de sécurité d'un préréglage personnalisé: ce qu'on baisse d'abord, un réglage par cran (le
 * plus coûteux pour le moins visible en premier). Haute, Moyenne et Basse descendent d'un préréglage.
 */
const LOWER_STEPS: readonly ((c: GraphicsLevels) => GraphicsLevels | null)[] = [
  (c) => (c.shadows === 'fine' ? { ...c, shadows: 'soft' } : null),
  (c) => (c.resolution === 'max' ? { ...c, resolution: 'standard' } : null),
  (c) => (c.shadows === 'soft' ? { ...c, shadows: 'off' } : null),
  (c) => (c.resolution === 'standard' ? { ...c, resolution: 'reduced' } : null),
  (c) => (c.effects === 'full' ? { ...c, effects: 'reduced' } : null),
];

export const DEFAULT_GRAPHICS_OPTIONS: GraphicsOptions = {
  preset: 'auto',
  custom: GRAPHICS_PRESETS.medium,
  neverReduce: false,
};

function pick<T extends string>(values: readonly T[], raw: unknown, fallback: T): T {
  const found = values.find((v) => v === raw);
  return found ?? fallback;
}

function field(raw: unknown, key: string): unknown {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)[key]
    : undefined;
}

/**
 * Lecture tolérante d'options mémorisées (version passée, fichier abîmé): chaque champ illisible
 * reprend sa valeur par défaut, le reste est gardé.
 */
export function parseGraphicsOptions(raw: unknown): GraphicsOptions {
  const d = DEFAULT_GRAPHICS_OPTIONS;
  const custom = field(raw, 'custom');
  const neverReduce = field(raw, 'neverReduce');
  return {
    preset: pick(GRAPHICS_PRESET_ORDER, field(raw, 'preset'), d.preset),
    custom: {
      shadows: pick(SHADOW_LEVELS, field(custom, 'shadows'), d.custom.shadows),
      resolution: pick(RESOLUTION_LEVELS, field(custom, 'resolution'), d.custom.resolution),
      effects: pick(EFFECTS_LEVELS, field(custom, 'effects'), d.custom.effects),
    },
    neverReduce: typeof neverReduce === 'boolean' ? neverReduce : d.neverReduce,
  };
}

/** Niveaux d'un préréglage choisi à la main; `null` en Auto (la qualité adaptative décide). */
export function levelsOf(options: GraphicsOptions): GraphicsLevels | null {
  switch (options.preset) {
    case 'auto':
      return null;
    case 'custom':
      return options.custom;
    case 'high':
    case 'medium':
    case 'low':
      return GRAPHICS_PRESETS[options.preset];
  }
}

/** Niveaux montrés par le panneau et point de départ d'Auto: ceux de Moyenne. */
export function shownLevels(options: GraphicsOptions): GraphicsLevels {
  return levelsOf(options) ?? GRAPHICS_PRESETS.medium;
}

/**
 * Un réglage fin changé à la main: préréglage personnalisé, sauf si l'ensemble retombe exactement
 * sur Haute, Moyenne ou Basse.
 */
export function withLevel(
  options: GraphicsOptions,
  change: Partial<GraphicsLevels>,
): GraphicsOptions {
  const levels: GraphicsLevels = { ...shownLevels(options), ...change };
  for (const preset of ['high', 'medium', 'low'] as const) {
    const p = GRAPHICS_PRESETS[preset];
    if (
      p.shadows === levels.shadows &&
      p.resolution === levels.resolution &&
      p.effects === levels.effects
    ) {
      return { ...options, preset, custom: levels };
    }
  }
  return { ...options, preset: 'custom', custom: levels };
}

/** Un cran plus bas, ou `null` s'il n'y en a plus (Auto, Basse, réglages fins tous au minimum). */
export function lowerOptions(options: GraphicsOptions): GraphicsOptions | null {
  switch (options.preset) {
    case 'auto':
    case 'low':
      return null;
    case 'high':
      return { ...options, preset: 'medium' };
    case 'medium':
      return { ...options, preset: 'low' };
    case 'custom':
      for (const step of LOWER_STEPS) {
        const next = step(options.custom);
        if (next !== null) return withLevel(options, next);
      }
      return null;
  }
}

/**
 * Mémoire des options de cette machine. `read` rend la valeur brute, `write` la garde; une erreur
 * de l'une ou l'autre ne doit jamais gêner la partie.
 */
export interface GraphicsStorage {
  read(): unknown;
  write(value: GraphicsOptions): void;
}

/**
 * Mémoire de la page, pour la séance. Le contrat des jeux (ADR 0004 et 0005) interdit le stockage
 * du navigateur, vidé à chaque partie, et le SDK n'offre pas encore de réglages par machine: le jour
 * où il en offre, `main.ts` lui branche une autre `GraphicsStorage`, rien d'autre ne change.
 */
export function sessionGraphicsStorage(): GraphicsStorage {
  let kept: string | null = null;
  return {
    read: () => (kept === null ? null : (JSON.parse(kept) as unknown)),
    write: (value) => {
      kept = JSON.stringify(value);
    },
  };
}

export function loadGraphicsOptions(storage: GraphicsStorage): GraphicsOptions {
  try {
    return parseGraphicsOptions(storage.read());
  } catch {
    return DEFAULT_GRAPHICS_OPTIONS;
  }
}

export function saveGraphicsOptions(storage: GraphicsStorage, options: GraphicsOptions): void {
  try {
    storage.write(options);
  } catch {
    // Mémoire indisponible: les options valent pour la séance, rien de plus.
  }
}

/** Ce que l'interface sait faire des options (donné par `main.ts`, branché sur le rendu). */
export interface GraphicsPort {
  current(): GraphicsOptions;
  /** Vrai si les options restent sur la machine d'une partie à l'autre (sinon: pour la partie). */
  readonly persistent: boolean;
  /** Applique à chaud et mémorise. */
  set(options: GraphicsOptions): void;
  /** Le filet de sécurité vient de descendre d'un cran (notification discrète). */
  onReduced(listener: (options: GraphicsOptions) => void): () => void;
}
