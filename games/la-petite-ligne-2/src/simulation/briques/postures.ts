/**
 * Postures tenues sur un meuble: assis (brique `sit`) ou couché (brique `sleep`). La place prise
 * vit dans l'état des briques du meuble; on la quitte en donnant une direction.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { PropDef } from '../../donnees/schemas/meuble';
import { bodyCollides, nearestFreeCell, type Vec2 } from '../noyau/grille';
import {
  currentBlockers,
  findProp,
  footprintOf,
  type PropInstance,
  type ReadPlace,
} from '../noyau/obstacles';
import { CORE_TUNING } from '../noyau/reglages-noyau';
import type { SimContext } from '../noyau/systemes';

export type PostureKind = 'sit' | 'sleep';

export interface Posture {
  readonly object: string;
  readonly kind: PostureKind;
  readonly seat: number;
}

const KINDS: readonly PostureKind[] = ['sit', 'sleep'];

/** La place que tient ce joueur dans le lieu, `null` s'il est debout. */
export function postureOf(place: ReadPlace, player: PlayerIndex): Posture | null {
  for (const object in place.objects) {
    const states = place.objects[object];
    if (states === undefined) continue;
    for (const kind of KINDS) {
      const seat = states[kind]?.indexOf(player) ?? -1;
      if (seat >= 0) return { object, kind, seat };
    }
  }
  return null;
}

/** Première place libre, -1 si tout est pris. */
export function freeSeat(seats: readonly (PlayerIndex | null)[] | undefined): number {
  return seats?.indexOf(null) ?? -1;
}

/** Façade d'un meuble: 0 au sud, puis par quarts de tour (est, nord, ouest). */
function front(rotation: number, out: Vec2): Vec2 {
  out.x = rotation === 1 ? 1 : rotation === 3 ? -1 : 0;
  out.y = rotation === 0 ? 1 : rotation === 2 ? -1 : 0;
  return out;
}

const facade: Vec2 = { x: 0, y: 0 };
const spot: Vec2 = { x: 0, y: 0 };

/** Décalage d'une place le long de la largeur du meuble (m): les places se partagent la largeur. */
function seatOffset(def: PropDef, seats: number, seat: number): number {
  return ((seat + 0.5) / seats - 0.5) * def.size.w;
}

/**
 * Place libre la plus proche de ce joueur, -1 si tout est pris. Deux joueurs qui s'assoient l'un
 * après l'autre prennent chacun la place de leur côté, côte à côte, plutôt que la première de la
 * liste (qui les mettait en diagonale autour d'une table).
 */
export function nearestFreeSeat(
  sim: SimContext,
  player: PlayerIndex,
  prop: PropInstance,
  def: PropDef,
  seats: readonly (PlayerIndex | null)[],
): number {
  const body = sim.world.players[player].body;
  const f = front(prop.rotation, facade);
  let best = -1;
  let bestDistance = Infinity;
  for (let seat = 0; seat < seats.length; seat++) {
    if (seats[seat] !== null) continue;
    const along = seatOffset(def, seats.length, seat);
    const dx = prop.x + f.y * along - body.x;
    const dy = prop.y - f.x * along - body.y;
    const distance = dx * dx + dy * dy;
    // Égalité: la première place, pour un choix identique sur les deux machines.
    if (distance < bestDistance - 1e-9) {
      best = seat;
      bestDistance = distance;
    }
  }
  return best;
}

/** Installe le joueur à cette place: sur le meuble, tourné vers sa façade. */
export function settle(
  sim: SimContext,
  player: PlayerIndex,
  prop: PropInstance,
  def: PropDef,
  seats: (PlayerIndex | null)[],
  seat: number,
): void {
  seats[seat] = player;
  const f = front(prop.rotation, facade);
  const along = seatOffset(def, seats.length, seat);
  const body = sim.world.players[player].body;
  body.x = prop.x + f.y * along;
  body.y = prop.y - f.x * along;
  body.facing = Math.atan2(f.y, f.x);
  body.speed = 0;
  sim.touch('place');
}

/** Relève le joueur: il se retrouve devant sa place, sinon sur la case libre la plus proche. */
export function standUp(sim: SimContext, player: PlayerIndex): boolean {
  const { world, content } = sim;
  const placeContent = content.places[world.common.place];
  const place = world.places[world.common.place];
  if (place === undefined || placeContent === undefined) return false;
  const posture = postureOf(place, player);
  if (posture === null) return false;
  const seats = place.objects[posture.object]?.[posture.kind];
  if (seats !== undefined) seats[posture.seat] = null;
  sim.touch('place');
  const prop = findProp(placeContent, place, posture.object);
  const def = prop === null ? undefined : content.props[prop.type];
  const blockers = currentBlockers(content, world);
  if (prop === null || def === undefined || blockers === null) return true;
  const body = world.players[player].body;
  const radius = content.settings.movement.radius;
  const f = front(prop.rotation, facade);
  const depth = footprintOf(def, prop.rotation);
  const out = (f.x !== 0 ? depth.w : depth.h) / 2 + radius + CORE_TUNING.standUpGap;
  const x = body.x + f.x * out;
  const y = body.y + f.y * out;
  if (!bodyCollides(blockers, x, y, radius)) {
    body.x = x;
    body.y = y;
  } else if (nearestFreeCell(blockers, x, y, spot)) {
    body.x = spot.x;
    body.y = spot.y;
  }
  return true;
}
