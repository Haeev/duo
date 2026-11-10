/**
 * Personnages coincés (retour R01 de l'ancien jeu: pris sous un meuble posé). Trois garde-fous,
 * tous chez l'hôte: un personnage pris dans un obstacle qui pousse sans avancer est dégagé seul
 * (`deplacement.ts`); l'intention `unstick` replace le joueur sur la case la plus proche d'où l'on
 * rejoint le quai d'arrivée; au chargement et à l'arrivée d'un train, qui est pris est dégagé.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { WorldState } from '../../etat/monde';
import {
  bodyCollides,
  isBlockedCell,
  nearestFreeCell,
  reachableCells,
  type Blockers,
  type Vec2,
} from './grille';
import { currentBlockers } from './obstacles';

const anchor: Vec2 = { x: 0, y: 0 };

/** Les portes d'une carte (`map.doors`): elles relient les pièces d'un lieu sur la même grille. */
export type Doors = Readonly<
  Record<string, { readonly x: number; readonly y: number; readonly to: string }>
>;

const AROUND = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/**
 * Cases reliées au point d'arrivée du lieu (le quai): de là, on rejoint tout ce qui se joue. Une
 * porte atteinte relie la pièce de sa jumelle, même fermée à clé: qui est entré dans une maison
 * n'y est pas coincé (on ressort toujours), il y reparaît donc à la reprise.
 */
function connected(b: Blockers, arrivalX: number, arrivalY: number, doors?: Doors): Set<number> {
  const blocked = isBlockedCell(b, Math.floor(arrivalX), Math.floor(arrivalY));
  if (blocked && !nearestFreeCell(b, arrivalX, arrivalY, anchor)) return new Set();
  const seen = blocked
    ? reachableCells(b, anchor.x, anchor.y)
    : reachableCells(b, arrivalX, arrivalY);
  if (doors === undefined) return seen;
  const pending = new Set(Object.keys(doors));
  for (let grew = true; grew;) {
    grew = false;
    for (const id of pending) {
      const door = doors[id];
      const twin = door === undefined ? undefined : doors[door.to];
      if (door === undefined || twin === undefined) continue;
      const dx = Math.floor(door.x);
      const dy = Math.floor(door.y);
      if (!AROUND.some(([ox, oy]) => seen.has((dy + oy) * b.width + dx + ox))) continue;
      pending.delete(id);
      // La pièce de la jumelle: sa case, ou celles qui la touchent si la porte l'occupe.
      for (const [ox, oy] of AROUND) {
        const tx = Math.floor(twin.x) + ox;
        const ty = Math.floor(twin.y) + oy;
        if (isBlockedCell(b, tx, ty) || seen.has(ty * b.width + tx)) continue;
        for (const cell of reachableCells(b, tx, ty)) seen.add(cell);
        grew = true;
      }
    }
  }
  return seen;
}

/** Pris: dans un obstacle, ou sur une case d'où l'on ne rejoint pas le quai. */
export function isStuck(
  b: Blockers,
  x: number,
  y: number,
  radius: number,
  arrivalX: number,
  arrivalY: number,
  doors?: Doors,
): boolean {
  if (bodyCollides(b, x, y, radius)) return true;
  return !connected(b, arrivalX, arrivalY, doors).has(Math.floor(y) * b.width + Math.floor(x));
}

/**
 * Où dégager un corps: le centre de la case reliée au quai la plus proche de lui (à distance
 * égale, la première dans l'ordre des cases). Faux si le lieu n'a aucune case libre.
 */
export function unstickSpot(
  b: Blockers,
  x: number,
  y: number,
  arrivalX: number,
  arrivalY: number,
  out: Vec2,
  doors?: Doors,
): boolean {
  let best = Number.POSITIVE_INFINITY;
  let bestIndex = Number.POSITIVE_INFINITY;
  for (const i of connected(b, arrivalX, arrivalY, doors)) {
    const cx = i % b.width;
    const cy = (i - cx) / b.width;
    const d = (cx + 0.5 - x) ** 2 + (cy + 0.5 - y) ** 2;
    if (d < best - 1e-9 || (Math.abs(d - best) <= 1e-9 && i < bestIndex)) {
      best = d;
      bestIndex = i;
      out.x = cx + 0.5;
      out.y = cy + 0.5;
    }
  }
  return best !== Number.POSITIVE_INFINITY;
}

const spot: Vec2 = { x: 0, y: 0 };

/** Dégage ce joueur s'il est pris. Renvoie vrai s'il a été replacé. */
export function freePlayer(content: Content, world: WorldState, player: PlayerIndex): boolean {
  const place = content.places[world.common.place];
  const arrival = place?.map.points[place.def.station.arrival];
  const b = currentBlockers(content, world);
  if (b === null || arrival === undefined) return false;
  const body = world.players[player].body;
  const radius = content.settings.movement.radius;
  const doors = place?.map.doors;
  if (!isStuck(b, body.x, body.y, radius, arrival.x, arrival.y, doors)) return false;
  if (!unstickSpot(b, body.x, body.y, arrival.x, arrival.y, spot, doors)) return false;
  body.x = spot.x;
  body.y = spot.y;
  body.speed = 0;
  return true;
}
