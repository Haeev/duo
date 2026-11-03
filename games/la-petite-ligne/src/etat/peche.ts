/**
 * Pêche de la 0.12 (`docs/jeux/jeu-1/peche-0-12-conception.md`): l'état partagé par la simulation,
 * le rendu et l'interface (`WorldState.fishing`), et des lectures pures de cet état.
 *
 * Contrat avec le rendu: les ombres ne changent dans l'état qu'aux événements (apparition, approche,
 * touche, départ, fuite). Entre deux, le rendu les fait nager lui-même dans le disque `roam` autour
 * de `pos` (tout ce disque est dans l'eau, à `minShoreDistance` au moins d'une berge), selon la
 * rareté (section 5.2). Un déplacement décidé par la simulation se lit par `shadowPosAt`.
 */
import type { CharacterId, ItemId, Vec2 } from './types';

export type FishRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
export const FISH_RARITIES: readonly FishRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];

/** Taille de l'ombre (longueurs dans `reglages.fishing.shadows.sizes`: 0,30, 0,50, 0,80, 1,20 m). */
export type ShadowSize = 'small' | 'medium' | 'large' | 'huge';
export const SHADOW_SIZES: readonly ShadowSize[] = ['small', 'medium', 'large', 'huge'];

/**
 * Ce que fait une ombre.
 * - `free`: nage dans son disque; on peut la viser.
 * - `approach`: vient sous le bouchon de `line` (déplacement `move`).
 * - `under`: sous le bouchon de `line`, jusqu'à la touche et au ferrage.
 * - `leaving`: fin de vie, glisse vers le fond et s'efface (`fadeSeconds`), jusqu'à `ends`.
 * - `fleeing`: ferrage manqué, file (`fleeSpeed`) et s'efface en `fleeSeconds`, jusqu'à `ends`.
 */
export type ShadowState = 'free' | 'approach' | 'under' | 'leaving' | 'fleeing';

export interface FishShadow {
  /** Numéro unique (ordre d'apparition); identité stable pour le rendu. */
  id: number;
  /** Coin de pêche (`map.fishingZones[].id`). */
  zone: string;
  /** Poisson tiré à l'apparition: c'est lui qui mord si l'on vise cette ombre. */
  fish: ItemId;
  rarity: FishRarity;
  size: ShadowSize;
  /** Où elle se tient (m). Pendant `move`: le point d'arrivée. */
  pos: Vec2;
  /** Rayon (m) du disque autour de `pos` où le rendu la fait nager; 0 sous un bouchon. */
  roam: number;
  /** Cap au repos (radians, convention de `facing`: 0 vers l'est, PI/2 vers le sud). */
  heading: number;
  /** Déplacement en cours, en ligne droite de `from` à `pos`, du pas `since` au pas `until`. */
  move: { from: Vec2; since: number; until: number } | null;
  state: ShadowState;
  /** Ligne qui la réserve (`approach`, `under`), sinon `null`. */
  line: CharacterId | null;
  /** Pas d'apparition: fondu d'entrée de `fadeSeconds` à partir de là. */
  born: number;
  /** `free`: fin de vie prévue; `leaving` et `fleeing`: pas où elle a fini de s'effacer. */
  ends: number;
  /** Mythique: seuls les guetteurs la voient (section 7.2). */
  watchOnly: boolean;
}

/** Guet d'un joueur (section 7.2): immobile au bord depuis `since`; `active` après `stillSeconds`. */
export interface WatchState {
  zone: string;
  since: number;
  active: boolean;
}

/** Un légendaire ou un mythique présent aujourd'hui (tiré à l'aube). */
export interface GrandToday {
  fish: ItemId;
  zone: string;
  /** Plus de présence aujourd'hui (pris ou manqué). */
  gone: boolean;
}

/** Mythique ferré: l'autre joueur a jusqu'au pas `until` pour tendre l'épuisette. */
export interface LandingState {
  fisher: CharacterId;
  fish: ItemId;
  shadow: number;
  until: number;
  cm: number;
}

/** Page du carnet des poissons (section 7.4). */
export interface FishLogEntry {
  /** Prises du duo. */
  count: number;
  first: { day: number; by: CharacterId; zone: string; together: boolean };
  record: { cm: number; by: CharacterId; day: number };
}

export interface FishingState {
  /** Ombres des coins éveillés. Jamais sauvegardées (vidées à l'écriture). */
  shadows: FishShadow[];
  /**
   * Coins éveillés: pas où le coin s'endormira si personne ne revient (`null` tant qu'un joueur est
   * près), prochain pas d'apparition d'une ombre. Jamais sauvegardés.
   */
  zones: Record<string, { sleepAt: number | null; nextSpawn: number }>;
  /** Prochain numéro d'ombre (clé des tirages). */
  nextShadow: number;
  /** Coin qui frémit du jour (section 6), le même chez les deux. */
  hotSpot: { day: number; zone: string } | null;
  /** Guet de chacun, `null` s'il ne guette pas. Jamais sauvegardé. */
  watch: Record<CharacterId, WatchState | null>;
  /** Grands du jour (jour du tirage, liste). */
  grands: { day: number; list: GrandToday[] };
  /** Mythique ferré en attente de l'épuisette, sinon `null`. Jamais sauvegardé. */
  landing: LandingState | null;
  /** Carnet des poissons du duo, par poisson pris au moins une fois. */
  log: Record<ItemId, FishLogEntry>;
  /** Dernier jour de prise de chaque grand (limites par saison et par année). */
  grandsCaught: Record<ItemId, number>;
  /** Série de chacun: dernier poisson pris et combien de fois de suite. */
  streak: Record<CharacterId, { fish: ItemId; count: number } | null>;
  /** Communs de suite pour le duo (filet des communs). */
  commonsInRow: number;
  /** Dernier preneur (le filet sert dans son coin). */
  lastCatchZone: string | null;
}

export function emptyFishing(): FishingState {
  return {
    shadows: [],
    zones: {},
    nextShadow: 0,
    hotSpot: null,
    watch: { p1: null, p2: null },
    grands: { day: 0, list: [] },
    landing: null,
    log: {},
    grandsCaught: {},
    streak: { p1: null, p2: null },
    commonsInRow: 0,
    lastCatchZone: null,
  };
}

/** Position de l'ancre d'une ombre au pas `tick` (fractionnaire pour l'interpolation du rendu). */
export function shadowPosAt(shadow: Readonly<Pick<FishShadow, 'pos' | 'move'>>, tick: number, out: Vec2 = { x: 0, y: 0 }): Vec2 {
  const m = shadow.move;
  if (m === null || tick >= m.until || m.until <= m.since) {
    out.x = shadow.pos.x;
    out.y = shadow.pos.y;
    return out;
  }
  const t = Math.max(0, (tick - m.since) / (m.until - m.since));
  out.x = m.from.x + (shadow.pos.x - m.from.x) * t;
  out.y = m.from.y + (shadow.pos.y - m.from.y) * t;
  return out;
}

/** Le joueur voit-il cette ombre ? Les mythiques ne se montrent qu'à un guetteur. */
export function shadowVisibleTo(fishing: Readonly<Pick<FishingState, 'watch'>>, shadow: Readonly<Pick<FishShadow, 'watchOnly'>>, viewer: CharacterId): boolean {
  return !shadow.watchOnly || fishing.watch[viewer]?.active === true;
}

/** Le joueur fait-il le guet (éclats des rares et plus, lueur des mythiques) ? */
export function isWatching(fishing: Readonly<Pick<FishingState, 'watch'>>, viewer: CharacterId): boolean {
  return fishing.watch[viewer]?.active === true;
}

/** Nombre d'écailles affichées à côté du nom (section 3.2): 1 pour un commun, 5 pour un mythique. */
export function rarityScales(rarity: FishRarity): number {
  return FISH_RARITIES.indexOf(rarity) + 1;
}
