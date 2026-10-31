/**
 * Bancs de la carte (modèle `bench`): places assises, point où l'on se relève,
 * et place prise par un habitant arrêté. Géométrie pure, partagée par la
 * simulation (qui réserve les places) et le rendu (qui y pose les corps):
 * les deux calculent exactement les mêmes positions.
 *
 * Repère du banc: quart de tour de la carte (0 tourné vers le sud, +y), le
 * long du banc (X du modèle) et vers l'avant (Z du modèle, côté assise).
 */
import type { BenchSettings } from '../donnees/types';
import type { GameMap, MapProp } from './carte';

export const BENCH_MODEL = 'bench';

/** Une place: milieu de l'assise et orientation du corps assis (dos au dossier). */
export interface BenchPlace {
  x: number;
  y: number;
  facing: number;
}

/** Place occupée par un joueur (`Character.seat`). */
export interface BenchSeat {
  bench: string;
  /** Index dans `BenchSettings.slots`. */
  slot: number;
  /** Tick où il s'est assis (durée assise des envies et des quêtes). */
  since: number;
}

const benchCache = new WeakMap<GameMap, readonly MapProp[]>();

/** Les bancs de la carte (calculé une fois par carte). */
export function benchesOf(map: GameMap): readonly MapProp[] {
  let list = benchCache.get(map);
  if (list === undefined) {
    list = map.props.filter((p) => p.model === BENCH_MODEL);
    benchCache.set(map, list);
  }
  return list;
}

export function benchById(map: GameMap, id: string): MapProp | null {
  return benchesOf(map).find((b) => b.id === id) ?? null;
}

function yaw(prop: MapProp): number {
  return prop.rotation * (Math.PI / 2);
}

/** Demi-longueur du banc (m), d'après son emprise. */
function halfLength(prop: MapProp): number {
  return (prop.rect === null ? 2 : Math.max(prop.rect.w, prop.rect.h)) / 2;
}

/** Écrit dans `out` la place `slot` du banc (sans allocation). */
export function seatPlace(prop: MapProp, slot: number, s: BenchSettings, out: BenchPlace): BenchPlace {
  const a = yaw(prop);
  const offset = s.slots[slot] ?? 0;
  // Le long (cos, -sin) et vers l'avant (sin, cos), comme le modèle tourné par le rendu.
  out.x = prop.pos.x + Math.cos(a) * offset + Math.sin(a) * s.seatForward;
  out.y = prop.pos.y - Math.sin(a) * offset + Math.cos(a) * s.seatForward;
  out.facing = Math.PI / 2 - a;
  return out;
}

/** Où l'on se relève: devant la place, à `standForward` m de l'assise (case libre). */
export function standPlace(prop: MapProp, slot: number, s: BenchSettings, out: BenchPlace): BenchPlace {
  seatPlace(prop, slot, s, out);
  const a = yaw(prop);
  out.x += Math.sin(a) * s.standForward;
  out.y += Math.cos(a) * s.standForward;
  return out;
}

/**
 * Position (x, y) dans la zone du banc où un habitant arrêté est tenu pour
 * assis: la place la plus proche parmi celles que le masque `taken` (un bit
 * par place) laisse libres, ou -1 hors de la zone ou sans place libre.
 */
export function villagerSlot(prop: MapProp, s: BenchSettings, x: number, y: number, taken: number): number {
  const a = yaw(prop);
  const dx = x - prop.pos.x;
  const dy = y - prop.pos.y;
  const along = dx * Math.cos(a) - dy * Math.sin(a);
  const front = dx * Math.sin(a) + dy * Math.cos(a);
  if (Math.abs(along) > halfLength(prop) + s.villagerReach || Math.abs(front) > 0.5 + s.villagerReach) return -1;
  let best = -1;
  let bestGap = Number.POSITIVE_INFINITY;
  for (let i = 0; i < s.slots.length; i++) {
    if ((taken & (1 << i)) !== 0) continue;
    const gap = Math.abs((s.slots[i] ?? 0) - along);
    if (gap < bestGap) {
      best = i;
      bestGap = gap;
    }
  }
  return best;
}

/** Ce qu'il faut savoir d'un personnage pour les places des bancs. */
export interface SeatCharacter {
  seat?: BenchSeat | null;
}

/**
 * Ce qu'il faut savoir d'un habitant: arrêté, visible, et rendu au point de
 * son emploi du temps qui est un banc (Jeanne au quai le matin), il s'y
 * assoit. Celui qui passe ou attend à côté (Firmin près de la cloche) reste debout.
 */
export interface SeatVillager {
  pos: { x: number; y: number };
  speed: number;
  visible: boolean;
  /** Point de l'emploi du temps où il va (`VillagerState.target`). */
  target: string;
}

/** Le point `target` désigne-t-il ce banc (dans son emprise, à un demi-mètre près) ? */
function targetsBench(prop: MapProp, at: { x: number; y: number } | undefined): boolean {
  return at !== undefined && Math.hypot(at.x - prop.pos.x, at.y - prop.pos.y) <= halfLength(prop) + 0.5;
}

/**
 * Places des bancs prises par les habitants: chacun, dans l'ordre de la
 * liste, prend la place libre la plus proche du banc où il s'est arrêté (le
 * point de son emploi du temps); les
 * joueurs assis passent avant (leur place est réservée par la simulation).
 * Tableaux gardés d'un appel à l'autre: aucune allocation à chaque image.
 */
export class BenchSeating {
  /** Banc de chaque habitant (index de la liste), ou `null`. */
  readonly bench: (MapProp | null)[] = [];
  /** Place de chaque habitant sur son banc, ou -1. */
  readonly slot: number[] = [];

  update(
    benches: readonly MapProp[],
    s: BenchSettings,
    points: Readonly<Record<string, { x: number; y: number }>>,
    characters: readonly SeatCharacter[],
    villagers: readonly SeatVillager[],
  ): void {
    this.bench.length = villagers.length;
    this.slot.length = villagers.length;
    for (let v = 0; v < villagers.length; v++) {
      this.bench[v] = null;
      this.slot[v] = -1;
      const villager = villagers[v];
      if (villager === undefined || !villager.visible || villager.speed > 0) continue;
      for (const prop of benches) {
        if (!targetsBench(prop, points[villager.target])) continue;
        const slot = villagerSlot(prop, s, villager.pos.x, villager.pos.y, this.takenMask(prop, characters, v));
        if (slot >= 0) {
          this.bench[v] = prop;
          this.slot[v] = slot;
          break;
        }
      }
    }
  }

  /** Places du banc déjà prises par les joueurs et par les habitants avant l'index `before` (un bit par place). */
  takenMask(prop: MapProp, characters: readonly SeatCharacter[], before: number): number {
    let mask = 0;
    for (const c of characters) {
      const seat = c.seat;
      if (seat?.bench === prop.id) mask |= 1 << seat.slot;
    }
    for (let v = 0; v < before; v++) {
      const slot = this.slot[v] ?? -1;
      if (this.bench[v] === prop && slot >= 0) mask |= 1 << slot;
    }
    return mask;
  }
}
