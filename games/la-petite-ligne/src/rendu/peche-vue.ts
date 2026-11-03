/**
 * Ce que le rendu lit de la pêche de la 0.12 (conception `peche-0-12-conception.md`, sections 5
 * à 7): ombres des poissons, coin qui frémit, guet, coins de pêche. Le rendu ne lit que cette vue;
 * seule `createStateFishingSource` la tire de l'état de la simulation (`world.fishing`, contrat
 * de `etat/peche.ts`), pour qu'un changement de forme ne touche qu'ici. La page de démonstration
 * fournit sa propre source (`EngineOptions.fishing`), ombres posées à la main.
 */
import type { GameMap } from '../etat/carte';
import {
  type FishRarity,
  type ShadowSize,
  type ShadowState,
  isWatching,
  shadowPosAt,
} from '../etat/peche';
import type { CharacterId, ReadonlyWorld, Vec2, WorldEvent } from '../etat/types';

export type { FishRarity, ShadowSize } from '../etat/peche';

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

/** Nom de la phase vue par le rendu pour chaque état de la simulation. */
const PHASES: Readonly<Record<ShadowState, ShadowPhase>> = {
  free: 'free',
  approach: 'approach',
  under: 'under',
  leaving: 'leave',
  fleeing: 'flee',
};
const PLAYERS: readonly CharacterId[] = ['p1', 'p2'];

/**
 * Source de l'état de la simulation (`world.fishing`, `FishingState`). Les vues des ombres sont
 * réutilisées d'une image à l'autre (aucune allocation par image).
 */
export function createStateFishingSource(): FishingSource {
  const cache = new Map<number, Mutable<FishShadowView> & { pos: Vec2; stamp: number }>();
  const shadows: FishShadowView[] = [];
  const watchers: CharacterId[] = [];
  const view: Mutable<FishingView> = { shadows, hotSpot: null, watchers };
  let stamp = 0;
  return {
    view(world: ReadonlyWorld): FishingView {
      const fishing = world.fishing;
      stamp += 1;
      shadows.length = 0;
      watchers.length = 0;
      for (const raw of fishing.shadows) {
        const phase = PHASES[raw.state];
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
        shadow.zone = raw.zone;
        shadow.species = raw.fish;
        shadow.rarity = raw.rarity;
        shadow.size = raw.size;
        shadow.roam = raw.roam;
        shadow.heading = raw.heading;
        shadow.phase = phase;
        shadow.watchOnly = raw.watchOnly === true;
        shadowPosAt(raw, world.tick, shadow.pos);
        const line = raw.line;
        const angler = line === undefined ? undefined : world.characters.find((c) => c.id === line);
        shadow.target = angler?.fishing?.bobber ?? null;
        shadows.push(shadow);
      }
      for (const [id, shadow] of cache) {
        if (shadow.stamp !== stamp) cache.delete(id);
      }
      view.hotSpot = fishing.hotSpot?.zone ?? null;
      for (const id of PLAYERS) {
        if (isWatching(fishing, id)) watchers.push(id);
      }
      return view;
    },
    zones: readFishZones,
  };
}

/** Coins de pêche de la carte (`map.fishingZones`, rectangles `{ x, y, w, h }` en cases). */
export function readFishZones(map: GameMap): readonly FishZoneView[] {
  return (map.fishingZones ?? []).map((zone) => ({
    id: zone.id,
    rects: zone.rects.map((r) => ({ x0: r.x, y0: r.y, x1: r.x + r.w - 1, y1: r.y + r.h - 1 })),
  }));
}

/** Longueur de la prise (cm) si l'événement la donne (`caught.cm`), sinon `null`. */
export function caughtLength(event: Extract<WorldEvent, { type: 'caught' }>): number | null {
  const cm = event.cm;
  return cm !== undefined && Number.isFinite(cm) && cm > 0 ? cm : null;
}

/** La prise est-elle rendue à l'eau (`caught.released`, espèce protégée ou mythique) ? */
export function caughtReleased(event: Extract<WorldEvent, { type: 'caught' }>): boolean {
  return event.released === true;
}
