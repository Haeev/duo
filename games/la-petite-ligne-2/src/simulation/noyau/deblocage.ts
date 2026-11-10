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

/** Cases reliées au point d'arrivée du lieu (le quai): de là, on rejoint tout ce qui se joue. */
function connected(b: Blockers, arrivalX: number, arrivalY: number): Set<number> {
  if (!isBlockedCell(b, Math.floor(arrivalX), Math.floor(arrivalY)))
    return reachableCells(b, arrivalX, arrivalY);
  return nearestFreeCell(b, arrivalX, arrivalY, anchor)
    ? reachableCells(b, anchor.x, anchor.y)
    : new Set();
}

/** Pris: dans un obstacle, ou sur une case d'où l'on ne rejoint pas le quai. */
export function isStuck(
  b: Blockers,
  x: number,
  y: number,
  radius: number,
  arrivalX: number,
  arrivalY: number,
): boolean {
  if (bodyCollides(b, x, y, radius)) return true;
  return !connected(b, arrivalX, arrivalY).has(Math.floor(y) * b.width + Math.floor(x));
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
): boolean {
  let best = Number.POSITIVE_INFINITY;
  let bestIndex = Number.POSITIVE_INFINITY;
  for (const i of connected(b, arrivalX, arrivalY)) {
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
  if (!isStuck(b, body.x, body.y, radius, arrival.x, arrival.y)) return false;
  if (!unstickSpot(b, body.x, body.y, arrival.x, arrival.y, spot)) return false;
  body.x = spot.x;
  body.y = spot.y;
  body.speed = 0;
  return true;
}
