/**
 * S'asseoir sur un banc de la carte, par choix: Espace (ou un clic) près
 * d'une place libre fait s'asseoir, toute direction fait se lever. L'hôte
 * fait autorité: la place est réservée dans l'état (`Character.seat`), deux
 * places par banc, jamais deux corps sur la même (un habitant arrêté sur le
 * banc en tient une, comme le dessine le rendu).
 */
import {
  type BenchPlace,
  type BenchSeat,
  BenchSeating,
  FurnitureSeats,
  type SeatProp,
  benchById,
  benchesOf,
  benchesWithBuilt,
  benchForPoint,
  isFurnitureSeat,
  seatPlace,
  slotsOf,
  standPlace,
} from '../etat/bancs';
import type { GameMap, MapProp } from '../etat/carte';
import type { BenchSettings } from '../donnees/types';
import type { Character, DeepReadonly, PlacedFurniture, VillagerState, Vec2 } from '../etat/types';
import type { ItemDef } from '../donnees/types';
import { isHome, isSheltered } from '../etat/interieurs';
import { flagSeats, flaggedWorks } from '../etat/drapeaux';
import { SIM_HZ } from './constantes';
import { type Sim, distance, emit } from './contexte';
import { refreshBlockers, stopPath } from './deplacement';
import { bodyCollides, nearestFreeCell } from './grille';

/** Une place libre où s'asseoir: le banc, la place et le milieu de l'assise. */
export interface FreeSeat {
  bench: string;
  slot: number;
  pos: Vec2;
}

const seating = new BenchSeating();

/** Chantiers bâtis, dans l'ordre de `chantiers.json` (leurs bancs s'ajoutent à ceux de la carte). */
function builtImprovements(sim: Sim): string[] {
  const built = sim.content.improvements.filter((x) => (sim.world.improvements[x.id]?.builtDay ?? null) !== null).map((x) => x.id);
  // 0.13: le banc d'Hortense, posé sous le tilleul, est levé par un drapeau et non payé au tableau.
  for (const id of flaggedWorks(sim.content.settings.flagEffects, sim.world.flags)) if (!built.includes(id)) built.push(id);
  return built;
}

/** Sièges des meubles posés, par simulation (plusieurs simulations par fichier de test). */
const furnitureSeats = new WeakMap<Sim['world'], FurnitureSeats>();

/** Les sièges posés dans la maison (chaises, fauteuils: S07), du même identifiant que le meuble. */
export function homeSeats(sim: Sim): readonly SeatProp[] {
  let seats = furnitureSeats.get(sim.world);
  if (seats === undefined) {
    seats = new FurnitureSeats();
    furnitureSeats.set(sim.world, seats);
  }
  return seats.update(sim.world.furniture, sim.content.items);
}

/**
 * Les bancs où un joueur peut s'asseoir: ceux de la carte, ses sièges, les bancs des chantiers
 * bâtis (tour 9) et les sièges posés dans la maison (0.11.2).
 */
export function playerBenches(sim: Sim): readonly SeatProp[] {
  const outdoor = benchesWithBuilt(sim.map, builtImprovements(sim));
  const home = homeSeats(sim);
  const chairs = flagSeats(sim.content.settings.flagEffects, sim.world.flags);
  return home.length === 0 && chairs.length === 0 ? outdoor : [...outdoor, ...chairs, ...home];
}

export function playerBench(sim: Sim, id: string): SeatProp | null {
  return playerBenches(sim).find((b) => b.id === id) ?? null;
}

/**
 * Ce siège est-il à la portée de ce personnage, du bon côté des murs ? Les sièges de la maison de
 * dedans seulement, les bancs du dehors pas d'un bâtiment à l'abri.
 */
export function seatReachable(c: Character, prop: MapProp): boolean {
  return isFurnitureSeat(prop) ? isHome(c) : !isSheltered(c);
}
const scratch: BenchPlace = { x: 0, y: 0, facing: 0 };

/** La place `slot` du banc est-elle prise (par un joueur assis ou un habitant arrêté dessus) ? */
export function slotTaken(sim: Sim, prop: MapProp, slot: number): boolean {
  const { world } = sim;
  for (const c of world.characters) if (c.seat?.bench === prop.id && c.seat.slot === slot) return true;
  seating.update(benchesOf(sim.map), sim.content.settings.benches, sim.map.points, world.characters, world.villagers);
  for (let v = 0; v < world.villagers.length; v++) {
    if (seating.bench[v] === prop && seating.slot[v] === slot) return true;
  }
  return false;
}

/** Places du banc toutes prises ? */
export function benchFull(sim: Sim, prop: SeatProp): boolean {
  const slots = slotsOf(prop, sim.content.settings.benches).length;
  for (let i = 0; i < slots; i++) if (!slotTaken(sim, prop, i)) return false;
  return true;
}

/**
 * Les places libres à portée (`benches.sitRange`) d'un point, de la plus
 * proche à la plus loin. Avec `c`: seulement celles qu'il atteint de là où il
 * est (`seatReachable`: une chaise de la maison ne se prend pas à travers le mur).
 */
export function freeSeatsNear(sim: Sim, at: Vec2, range: number, c?: Character): FreeSeat[] {
  const s = sim.content.settings.benches;
  const out: (FreeSeat & { d: number })[] = [];
  for (const prop of playerBenches(sim)) {
    if (c !== undefined && !seatReachable(c, prop)) continue;
    const slots = slotsOf(prop, s);
    for (let slot = 0; slot < slots.length; slot++) {
      const place = seatPlace(prop, slot, s, scratch);
      const d = distance(at, place);
      if (d > range || slotTaken(sim, prop, slot)) continue;
      out.push({ bench: prop.id, slot, pos: { x: place.x, y: place.y }, d });
    }
  }
  out.sort((a, b) => a.d - b.d);
  return out.map(({ bench, slot, pos }) => ({ bench, slot, pos }));
}

/** Un banc plein à portée de ce personnage (pour dire pourquoi Espace ne fait rien). */
export function fullBenchNear(sim: Sim, c: Character): MapProp | null {
  const s = sim.content.settings.benches;
  for (const prop of playerBenches(sim)) {
    if (!seatReachable(c, prop)) continue;
    const slots = slotsOf(prop, s).length;
    for (let slot = 0; slot < slots; slot++) {
      if (distance(c.pos, seatPlace(prop, slot, s, scratch)) <= s.sitRange && benchFull(sim, prop)) return prop;
    }
  }
  return null;
}

/** S'assoit à la place `slot` du banc (libre: vérifié par l'appelant ou ici). Vrai si c'est fait. */
export function sitDown(sim: Sim, c: Character, benchId: string, slot: number): boolean {
  const prop = playerBench(sim, benchId);
  // Hors de la journée de jeu (nuit, écran de fin), `updateSeats` relèverait au même pas.
  if (sim.world.phase !== 'day' || prop === null || c.seat !== null || !seatReachable(c, prop) || slotTaken(sim, prop, slot)) return false;
  if (slot < 0 || slot >= slotsOf(prop, sim.content.settings.benches).length) return false;
  const place = seatPlace(prop, slot, sim.content.settings.benches, scratch);
  stopPath(sim, c);
  c.pos.x = place.x;
  c.pos.y = place.y;
  c.prev.x = place.x;
  c.prev.y = place.y;
  c.facing = place.facing;
  c.speed = 0;
  c.seat = { bench: benchId, slot, since: sim.world.tick };
  c.action = { kind: 'sit', since: sim.world.tick, duration: 0, target: null };
  sim.runtime.changed = true;
  emit(sim, { type: 'sat_down', by: c.id, bench: benchId, slot });
  return true;
}

/**
 * Où ce personnage assis se relève: devant sa place, sinon derrière le banc,
 * sinon la case libre la plus proche. Écrit dans `out`; faux s'il n'est pas assis.
 * Le même calcul sert à l'hôte et à la prédiction de l'invité.
 */
export function standingSpot(sim: Sim, c: Character, out: Vec2): boolean {
  const seat = c.seat;
  const prop = seat === null ? null : playerBench(sim, seat.bench);
  if (seat === null || prop === null) return false;
  const s = sim.content.settings.benches;
  const b = refreshBlockers(sim);
  const front = standPlace(prop, seat.slot, s, scratch);
  if (!bodyCollides(b, front.x, front.y)) {
    out.x = front.x;
    out.y = front.y;
    return true;
  }
  const back = standPlace(prop, seat.slot, { ...s, standForward: -s.standForward }, scratch);
  if (!bodyCollides(b, back.x, back.y)) {
    out.x = back.x;
    out.y = back.y;
    return true;
  }
  const free = nearestFreeCell(b, { x: front.x, y: front.y });
  out.x = free?.x ?? front.x;
  out.y = free?.y ?? front.y;
  return true;
}

/** Se relève (devant sa place). Vrai s'il était assis. */
export function standUp(sim: Sim, c: Character): boolean {
  const seat = c.seat;
  if (seat === null) return false;
  const spot = { x: c.pos.x, y: c.pos.y };
  standingSpot(sim, c, spot);
  c.pos.x = spot.x;
  c.pos.y = spot.y;
  c.prev.x = spot.x;
  c.prev.y = spot.y;
  c.seat = null;
  if (c.action.kind === 'sit') c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
  sim.runtime.changed = true;
  emit(sim, { type: 'stood_up', by: c.id, bench: seat.bench });
  return true;
}

/**
 * Secondes passées assis d'affilée sur un banc à portée du point
 * (`ranges.stayAt`), 0 si le personnage est debout ou ailleurs.
 */
export function seatedSeconds(sim: Sim, c: Character, pointId: string): number {
  const seat = c.seat;
  const at = sim.map.points[pointId];
  if (seat === null || at === undefined || distance(c.pos, at) > sim.content.settings.ranges.stayAt) return 0;
  return (sim.world.tick - seat.since) / SIM_HZ;
}

/**
 * Après les déplacements: une place n'est gardée que par un personnage
 * encore dessus, dehors, en journée et éveillé (un effet qui le déplace, la
 * nuit ou le lit le relèvent). Assis, il reprend la pose après un geste ou
 * une conversation.
 */
export function updateSeats(sim: Sim): void {
  const s = sim.content.settings.benches;
  for (const c of sim.world.characters) {
    const seat = c.seat;
    if (seat === null) continue;
    const prop = playerBench(sim, seat.bench);
    const place = prop === null ? null : seatPlace(prop, seat.slot, s, scratch);
    const away = place === null || Math.abs(place.x - c.pos.x) > 1e-6 || Math.abs(place.y - c.pos.y) > 1e-6;
    const asleep = c.status === 'sleeping' || c.status === 'night' || c.status === 'breakfast';
    if (away || asleep || prop === null || !seatReachable(c, prop) || sim.world.phase !== 'day') {
      // Encore sur sa place (la nuit tombe, la démo finit): reposé devant, sur une case libre,
      // jamais laissé dans l'emprise du banc. Déplacé par un effet, il reste où l'effet l'a mis.
      if (!away) {
        const spot = { x: c.pos.x, y: c.pos.y };
        standingSpot(sim, c, spot);
        stopPath(sim, c);
        c.pos.x = spot.x;
        c.pos.y = spot.y;
        c.prev.x = spot.x;
        c.prev.y = spot.y;
      }
      c.seat = null;
      if (c.action.kind === 'sit' && !c.absent) c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
      sim.runtime.changed = true;
      emit(sim, { type: 'stood_up', by: c.id, bench: seat.bench });
      continue;
    }
    const a = c.action;
    const gestureOver = a.duration === 0 || sim.world.tick >= a.since + a.duration;
    if (a.kind !== 'sit' && gestureOver && (a.kind === 'idle' || a.kind === 'talk' || a.kind === 'walk')) {
      c.action = { kind: 'sit', since: sim.world.tick, duration: 0, target: null };
      sim.runtime.changed = true;
    }
  }
}

/**
 * Place lue d'une sauvegarde: gardée si le banc existe, la place aussi, et
 * le personnage est bien dessus; sinon `null` (absente des sauvegardes
 * d'avant les bancs: debout).
 */
export function sanitizeSeat(
  map: GameMap,
  s: BenchSettings,
  c: { pos: Vec2; seat?: unknown },
  home?: { furniture: readonly DeepReadonly<PlacedFurniture>[]; items: Readonly<Record<string, ItemDef>> },
): BenchSeat | null {
  const raw = c.seat;
  if (typeof raw !== 'object' || raw === null) return null;
  const { bench, slot, since } = raw as Record<string, unknown>;
  if (typeof bench !== 'string' || typeof slot !== 'number' || typeof since !== 'number') return null;
  // Un siège posé dans la maison (0.11.2) se retrouve parmi les meubles relus.
  const seats = home === undefined ? [] : new FurnitureSeats().update(home.furniture, home.items);
  const prop: SeatProp | null = benchById(map, bench) ?? seats.find((x) => x.id === bench) ?? null;
  if (prop === null) return null;
  if (!Number.isInteger(slot) || slot < 0 || slot >= slotsOf(prop, s).length || !Number.isFinite(since)) return null;
  const place = seatPlace(prop, slot, s, scratch);
  if (Math.abs(place.x - c.pos.x) > 1e-6 || Math.abs(place.y - c.pos.y) > 1e-6) return null;
  return { bench, slot, since };
}

/** L'habitant est-il assis sur un banc (arrêté au banc de son emploi du temps) ? */
export function villagerSeated(sim: Sim, villagerId: string): boolean {
  const { world } = sim;
  seating.update(benchesOf(sim.map), sim.content.settings.benches, sim.map.points, world.characters, world.villagers);
  const index = world.villagers.findIndex((v) => v.id === villagerId);
  return index >= 0 && (seating.bench[index] ?? null) !== null;
}

/**
 * Où va un habitant dont le point de l'emploi du temps est un banc (le point
 * est au milieu de l'emprise, infranchissable): devant la place libre la plus
 * proche de lui, sinon derrière, comme un joueur qui se relève. Arrêté là, il
 * est tenu pour assis (`BenchSeating`). Écrit dans `out`; faux si le point
 * n'est pas un banc. Sans place libre, il attend devant la plus proche.
 */
export function villagerRestSpot(sim: Sim, v: VillagerState, pointId: string, out: Vec2): boolean {
  const prop = benchForPoint(benchesOf(sim.map), sim.map.points[pointId]);
  if (prop === null) return false;
  const s = sim.content.settings.benches;
  const { world } = sim;
  seating.update(benchesOf(sim.map), s, sim.map.points, world.characters, world.villagers);
  const self = world.villagers.indexOf(v);
  let best = -1;
  let bestFree = false;
  let bestD = Number.POSITIVE_INFINITY;
  for (let slot = 0; slot < s.slots.length; slot++) {
    let free = !world.characters.some((c) => c.seat?.bench === prop.id && c.seat.slot === slot);
    for (let i = 0; i < world.villagers.length && free; i++) {
      if (i !== self && seating.bench[i] === prop && seating.slot[i] === slot) free = false;
    }
    const d = distance(v.pos, standPlace(prop, slot, s, scratch));
    if ((free && !bestFree) || (free === bestFree && d < bestD)) {
      best = slot;
      bestFree = free;
      bestD = d;
    }
  }
  if (best < 0) return false;
  const b = refreshBlockers(sim);
  const front = standPlace(prop, best, s, scratch);
  if (!bodyCollides(b, front.x, front.y)) {
    out.x = front.x;
    out.y = front.y;
    return true;
  }
  const fx = front.x;
  const fy = front.y;
  const back = standPlace(prop, best, { ...s, standForward: -s.standForward }, scratch);
  if (!bodyCollides(b, back.x, back.y)) {
    out.x = back.x;
    out.y = back.y;
    return true;
  }
  const free = nearestFreeCell(b, { x: fx, y: fy });
  out.x = free?.x ?? fx;
  out.y = free?.y ?? fy;
  return true;
}
