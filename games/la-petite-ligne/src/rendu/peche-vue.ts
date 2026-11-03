/**
 * Ce que le rendu lit de la pêche de la 0.12 (conception `peche-0-12-conception.md`, sections 5
 * à 7): ombres des poissons, coin qui frémit, guet, coins de pêche. Le rendu ne lit que cette vue;
 * seule `createStateFishingSource` la tire de l'état de la simulation (`world.fishing`, contrat
 * de `etat/peche.ts` du lot 1), pour qu'un changement de forme ne touche qu'ici. La page de
 * démonstration fournit sa propre source (`EngineOptions.fishing`), ombres posées à la main.
 */
import type { GameMap } from '../etat/carte';
import type { CharacterId, ReadonlyWorld, Vec2, WorldEvent } from '../etat/types';

export type FishRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type ShadowSize = 'small' | 'medium' | 'large' | 'huge';

/**
 * Ce que fait une ombre: nage librement, vient au bouchon d'une ligne, attend dessous, file après
 * un ferrage manqué, ou glisse vers le fond en fin de vie.
 */
export type ShadowPhase = 'free' | 'approach' | 'under' | 'flee' | 'leave';

export interface FishShadowView {
  /** Numéro stable de l'ombre (le rendu garde sa nage et ses fondus d'une image à l'autre). */
  readonly id: number;
  readonly zone: string;
  /** Espèce (identifiant d'objet: `chub`, `golden_trout`...). */
  readonly species: string;
  readonly rarity: FishRarity;
  readonly size: ShadowSize;
  /** Ancre de la simulation (sol, m), déplacement en cours compris. */
  readonly pos: Readonly<Vec2>;
  /** Rayon du disque d'eau autour de `pos` où le rendu la fait nager (0 sous un bouchon). */
  readonly roam: number;
  /** Cap au repos (radians, convention de `facing`). */
  readonly heading: number;
  readonly phase: ShadowPhase;
  /** Bouchon de la ligne qui la réserve (approche, attente), sinon `null`. */
  readonly target: Readonly<Vec2> | null;
  /** Mythique: seuls les guetteurs la voient. */
  readonly watchOnly: boolean;
}

/** Un coin de pêche: ses cases (toutes ses cases, l'eau est triée par le rendu). */
export interface FishZoneView {
  readonly id: string;
  /** Rectangles de cases, bornes comprises: x de `x0` à `x1`, y de `y0` à `y1`. */
  readonly rects: readonly { x0: number; y0: number; x1: number; y1: number }[];
}

export interface FishingView {
  readonly shadows: readonly FishShadowView[];
  /** Coin qui frémit aujourd'hui, ou `null` (pas encore tiré, pêche fermée). */
  readonly hotSpot: string | null;
  /** Joueurs au guet (section 7.2): eux seuls voient les éclats et les mythiques. */
  readonly watchers: readonly CharacterId[];
}

/** D'où le rendu tire la pêche: l'état de la simulation, ou la page de démonstration. */
export interface FishingSource {
  view(world: ReadonlyWorld): FishingView | null;
  zones(map: GameMap): readonly FishZoneView[];
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

const PHASES: Readonly<Record<string, ShadowPhase>> = {
  free: 'free',
  approach: 'approach',
  under: 'under',
  leaving: 'leave',
  fleeing: 'flee',
};
const RARITIES: ReadonlySet<string> = new Set(['common', 'rare', 'epic', 'legendary', 'mythic']);
const SIZES: ReadonlySet<string> = new Set(['small', 'medium', 'large', 'huge']);
const PLAYERS: readonly CharacterId[] = ['p1', 'p2'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function vec(value: unknown): Vec2 | null {
  return isRecord(value) && typeof value.x === 'number' && typeof value.y === 'number'
    ? { x: value.x, y: value.y }
    : null;
}

/**
 * Source de l'état de la simulation. Lecture défensive (`world.fishing` n'est pas encore dans
 * `WorldState` tant que le lot 1 n'est pas fusionné): sans ce champ, aucune ombre ni aucun signe.
 * Les vues des ombres sont réutilisées d'une image à l'autre (aucune allocation par image).
 */
export function createStateFishingSource(): FishingSource {
  const cache = new Map<number, Mutable<FishShadowView> & { pos: Vec2; stamp: number }>();
  const shadows: FishShadowView[] = [];
  const watchers: CharacterId[] = [];
  const view: Mutable<FishingView> = { shadows, hotSpot: null, watchers };
  let stamp = 0;
  return {
    view(world: ReadonlyWorld): FishingView | null {
      // Champ absent du type tant que la simulation de la 0.12 n'est pas fusionnée.
      const fishing: unknown = (world as unknown as Record<string, unknown>).fishing;
      if (!isRecord(fishing)) return null;
      stamp += 1;
      shadows.length = 0;
      watchers.length = 0;
      const list = Array.isArray(fishing.shadows) ? (fishing.shadows as unknown[]) : [];
      for (const raw of list) {
        if (!isRecord(raw) || typeof raw.id !== 'number') continue;
        const phase = typeof raw.state === 'string' ? PHASES[raw.state] : undefined;
        const pos = vec(raw.pos);
        if (phase === undefined || pos === null) continue;
        let shadow = cache.get(raw.id);
        if (shadow === undefined) {
          shadow = {
            id: raw.id,
            zone: '',
            species: '',
            rarity: 'common',
            size: 'medium',
            pos: { x: 0, y: 0 },
            roam: 0,
            heading: 0,
            phase,
            target: null,
            watchOnly: false,
            stamp,
          };
          cache.set(raw.id, shadow);
        }
        shadow.stamp = stamp;
        shadow.zone = typeof raw.zone === 'string' ? raw.zone : '';
        shadow.species = typeof raw.fish === 'string' ? raw.fish : '';
        shadow.rarity =
          typeof raw.rarity === 'string' && RARITIES.has(raw.rarity)
            ? (raw.rarity as FishRarity)
            : 'common';
        shadow.size =
          typeof raw.size === 'string' && SIZES.has(raw.size) ? (raw.size as ShadowSize) : 'medium';
        shadow.roam = num(raw.roam, 0);
        shadow.heading = num(raw.heading, 0);
        shadow.phase = phase;
        shadow.watchOnly = raw.watchOnly === true;
        anchorAt(raw, pos, world.tick, shadow.pos);
        const line = raw.line;
        const angler =
          typeof line === 'string' ? world.characters.find((c) => c.id === line) : undefined;
        shadow.target = angler?.fishing?.bobber ?? null;
        shadows.push(shadow);
      }
      for (const [id, shadow] of cache) {
        if (shadow.stamp !== stamp) cache.delete(id);
      }
      const hot = fishing.hotSpot;
      view.hotSpot = isRecord(hot) && typeof hot.zone === 'string' ? hot.zone : null;
      const watch = fishing.watch;
      if (isRecord(watch)) {
        for (const id of PLAYERS) {
          const w = watch[id];
          if (isRecord(w) && w.active === true) watchers.push(id);
        }
      }
      return view;
    },
    zones: readFishZones,
  };
}

/** Ancre au pas `tick`: la ligne droite de `move.from` à `pos` (comme `shadowPosAt` de la simulation). */
function anchorAt(raw: Record<string, unknown>, pos: Vec2, tick: number, out: Vec2): void {
  const move = raw.move;
  const from = isRecord(move) ? vec(move.from) : null;
  const since = isRecord(move) ? num(move.since, 0) : 0;
  const until = isRecord(move) ? num(move.until, 0) : 0;
  if (from === null || tick >= until || until <= since) {
    out.x = pos.x;
    out.y = pos.y;
    return;
  }
  const t = Math.max(0, (tick - since) / (until - since));
  out.x = from.x + (pos.x - from.x) * t;
  out.y = from.y + (pos.y - from.y) * t;
}

/** Coins de pêche de la carte (`map.fishingZones`, rectangles `{ x, y, w, h }` en cases). */
export function readFishZones(map: GameMap): readonly FishZoneView[] {
  // Champ absent du type tant que la carte de la 0.12 (tâche C1) n'est pas fusionnée.
  const zones: unknown = (map as unknown as Record<string, unknown>).fishingZones;
  if (!Array.isArray(zones)) return [];
  const out: FishZoneView[] = [];
  for (const zone of zones as unknown[]) {
    if (!isRecord(zone) || typeof zone.id !== 'string' || !Array.isArray(zone.rects)) continue;
    const rects: FishZoneView['rects'][number][] = [];
    for (const r of zone.rects as unknown[]) {
      if (!isRecord(r)) continue;
      const x = num(r.x, NaN);
      const y = num(r.y, NaN);
      const w = num(r.w, NaN);
      const h = num(r.h, NaN);
      if (Number.isNaN(x + y + w + h) || w <= 0 || h <= 0) continue;
      rects.push({ x0: x, y0: y, x1: x + w - 1, y1: y + h - 1 });
    }
    out.push({ id: zone.id, rects });
  }
  return out;
}

/** Longueur de la prise (cm) si l'événement la donne (`caught.cm`), sinon `null`. */
export function caughtLength(event: Extract<WorldEvent, { type: 'caught' }>): number | null {
  const cm: unknown = (event as unknown as Record<string, unknown>).cm;
  return typeof cm === 'number' && Number.isFinite(cm) && cm > 0 ? cm : null;
}

/** La prise est-elle rendue à l'eau (`caught.released`, espèce protégée ou mythique) ? */
export function caughtReleased(event: Extract<WorldEvent, { type: 'caught' }>): boolean {
  return (event as unknown as Record<string, unknown>).released === true;
}
