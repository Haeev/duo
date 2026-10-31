/**
 * S'asseoir sur un banc de la carte, par choix: Espace (ou un clic) près
 * d'une place libre fait s'asseoir, toute direction fait se lever. L'hôte
 * fait autorité: la place est réservée dans l'état (`Character.seat`), deux
 * places par banc, jamais deux corps sur la même (un habitant arrêté sur le
 * banc en tient une, comme le dessine le rendu).
 */
import { type BenchPlace, type BenchSeat, BenchSeating, benchById, benchesOf, seatPlace, standPlace } from '../etat/bancs';
import type { GameMap, MapProp } from '../etat/carte';
import type { BenchSettings } from '../donnees/types';
import type { Character, Vec2 } from '../etat/types';
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
export function benchFull(sim: Sim, prop: MapProp): boolean {
  const slots = sim.content.settings.benches.slots.length;
  for (let i = 0; i < slots; i++) if (!slotTaken(sim, prop, i)) return false;
  return true;
}

/**
 * Les places libres à portée (`benches.sitRange`) d'un point, de la plus
 * proche à la plus loin. Personne ne s'assoit dans la maison (aucun banc).
 */
export function freeSeatsNear(sim: Sim, at: Vec2, range: number): FreeSeat[] {
  const s = sim.content.settings.benches;
  const out: (FreeSeat & { d: number })[] = [];
  for (const prop of benchesOf(sim.map)) {
    for (let slot = 0; slot < s.slots.length; slot++) {
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
  for (const prop of benchesOf(sim.map)) {
    for (let slot = 0; slot < s.slots.length; slot++) {
      if (distance(c.pos, seatPlace(prop, slot, s, scratch)) <= s.sitRange && benchFull(sim, prop)) return prop;
    }
  }
  return null;
}

/** S'assoit à la place `slot` du banc (libre: vérifié par l'appelant ou ici). Vrai si c'est fait. */
export function sitDown(sim: Sim, c: Character, benchId: string, slot: number): boolean {
  const prop = benchById(sim.map, benchId);
  if (prop === null || c.seat !== null || c.inHouse || slotTaken(sim, prop, slot)) return false;
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
  const prop = seat === null ? null : benchById(sim.map, seat.bench);
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
    const prop = benchById(sim.map, seat.bench);
    const place = prop === null ? null : seatPlace(prop, seat.slot, s, scratch);
    const away = place === null || Math.abs(place.x - c.pos.x) > 1e-6 || Math.abs(place.y - c.pos.y) > 1e-6;
    const asleep = c.status === 'sleeping' || c.status === 'night' || c.status === 'breakfast';
    if (away || asleep || c.inHouse || sim.world.phase !== 'day') {
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
export function sanitizeSeat(map: GameMap, s: BenchSettings, c: { pos: Vec2; seat?: unknown }): BenchSeat | null {
  const raw = c.seat;
  if (typeof raw !== 'object' || raw === null) return null;
  const { bench, slot, since } = raw as Record<string, unknown>;
  if (typeof bench !== 'string' || typeof slot !== 'number' || typeof since !== 'number') return null;
  if (!Number.isInteger(slot) || slot < 0 || slot >= s.slots.length || !Number.isFinite(since)) return null;
  const prop = benchById(map, bench);
  if (prop === null) return null;
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
