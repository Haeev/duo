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
 * Ce qu'il faut savoir d'un habitant: arrêté, visible, son point de l'emploi
 * du temps sur un banc (Jeanne au quai le matin), et rendu là où l'on se pose
 * pour une place (`standPlace`, où le mène la simulation), il s'y assoit.
 * Celui qui passe, attend à côté (Firmin près de la cloche) ou s'arrête en
 * chemin pour parler reste debout.
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

/** Le banc que désigne un point de l'emploi du temps (Jeanne au quai le matin), ou `null`. */
export function benchForPoint(benches: readonly MapProp[], at: { x: number; y: number } | undefined): MapProp | null {
  for (const prop of benches) if (targetsBench(prop, at)) return prop;
  return null;
}

/**
 * Écart (m) toléré entre un habitant et le point où il se pose devant (ou
 * derrière) une place: il y arrive exactement par son dernier pas. Plus large,
 * un habitant arrêté pour parler juste avant d'arriver se dessinerait assis,
 * puis debout en repartant (clignotement).
 */
const RESTING_GAP = 0.01;
const restScratch: BenchPlace = { x: 0, y: 0, facing: 0 };

/** L'habitant est-il arrêté là où l'on se pose pour une place du banc (devant, sinon derrière) ? */
function restsAt(prop: MapProp, s: BenchSettings, x: number, y: number): boolean {
  const out = restScratch;
  const a = yaw(prop);
  for (let slot = 0; slot < s.slots.length; slot++) {
    standPlace(prop, slot, s, out);
    if (Math.abs(out.x - x) <= RESTING_GAP && Math.abs(out.y - y) <= RESTING_GAP) return true;
    // Derrière: symétrique de l'avant par rapport à l'assise.
    const bx = out.x - 2 * Math.sin(a) * s.standForward;
    const by = out.y - 2 * Math.cos(a) * s.standForward;
    if (Math.abs(bx - x) <= RESTING_GAP && Math.abs(by - y) <= RESTING_GAP) return true;
  }
  return false;
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
        if (!restsAt(prop, s, villager.pos.x, villager.pos.y)) continue;
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
