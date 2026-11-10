/**
 * Portes et intérieurs (ADR 0016, 0022). Un intérieur est posé sur la grille du lieu, dans
 * l'annexe sous le dehors; on y entre par une paire de portes. Franchir une porte, c'est être
 * replacé à l'autre porte de la paire, tourné vers son `facing`: aucun état nouveau, la position
 * dit où l'on est. Chaque joueur a donc son intérieur, ou le dehors, indépendamment de l'autre.
 */
import type { PlaceContent } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { DoorDef } from '../../donnees/schemas/lieu';
import type { Body } from '../../etat/joueur';
import { isShopOpen } from '../habitants/lecture';
import { bodyCollides, nearestFreeCell, type Vec2 } from '../noyau/grille';
import { currentBlockers } from '../noyau/obstacles';
import type { SimContext } from '../noyau/systemes';
import { evaluateAll } from '../regles/conditions';
import { PLACES } from './reglages';
import type { PlaceLook } from './verrous';

/** Cap (radians, x vers l'est, y vers le sud) d'un quart de tour: 0 sud, 1 est, 2 nord, 3 ouest. */
export function quarterAngle(quarter: 0 | 1 | 2 | 3): number {
  return quarter === 0 ? Math.PI / 2 : quarter === 1 ? 0 : quarter === 2 ? -Math.PI / 2 : Math.PI;
}

/** L'intérieur qui contient (x, y), `null` dehors. */
export function interiorAt(place: PlaceContent, x: number, y: number): string | null {
  for (const room of place.interiors) {
    const { x: ox, y: oy } = room.at;
    if (x >= ox && y >= oy && x < ox + room.width && y < oy + room.height) return room.id;
  }
  return null;
}

/** L'intérieur où se trouve ce joueur, `null` dehors (lu par le rendu, la caméra, l'interface). */
export function playerInterior(look: PlaceLook, player: PlayerIndex): string | null {
  const place = look.content.places[look.world.common.place];
  if (place === undefined) return null;
  const body = look.world.players[player].body;
  return interiorAt(place, body.x, body.y);
}

/**
 * Clé de texte de ce qui empêche ce joueur de passer cette porte, `null` si elle est ouverte:
 * `door-locked` (conditions de la porte), `shop-closed` (hors des heures du commerce).
 */
export function doorRefusal(look: PlaceLook, player: PlayerIndex, door: DoorDef): string | null {
  if (
    door.opens !== undefined &&
    !evaluateAll({ world: look.world, content: look.content, actor: player }, door.opens)
  )
    return 'door-locked';
  if (door.shop !== undefined && !isShopOpen(look, door.shop)) return 'shop-closed';
  return null;
}

/** La porte (et son identifiant) dont `object` est l'objet visible, `null` sinon. */
export function doorOfObject(
  place: PlaceContent,
  object: string,
): { readonly id: string; readonly door: DoorDef } | null {
  const doors = place.map.doors ?? {};
  for (const id in doors) {
    const door = doors[id];
    if (door?.object === object) return { id, door };
  }
  return null;
}

/**
 * La porte à passer en marchant que ce corps touche en avançant vers elle, `null` sinon. Le corps
 * touche la case de la porte (élargie du rayon et de `doorReach`) et regarde vers son centre: on
 * ne repasse pas une porte dont on vient de sortir, puisqu'on en sort le dos tourné.
 */
export function touchedDoor(place: PlaceContent, body: Body, radius: number): string | null {
  const doors = place.map.doors;
  if (doors === undefined || body.speed <= 0) return null;
  const reach = radius + PLACES.doorReach;
  const fx = Math.cos(body.facing);
  const fy = Math.sin(body.facing);
  for (const id in doors) {
    const door = doors[id];
    if (door === undefined || (door.enter ?? 'walk') !== 'walk') continue;
    const cx = Math.floor(door.x);
    const cy = Math.floor(door.y);
    const dx = Math.max(cx - body.x, 0, body.x - (cx + 1));
    const dy = Math.max(cy - body.y, 0, body.y - (cy + 1));
    if (dx * dx + dy * dy > reach * reach) continue;
    if ((cx + 0.5 - body.x) * fx + (cy + 0.5 - body.y) * fy <= 0) continue;
    return id;
  }
  return null;
}

const spot: Vec2 = { x: 0, y: 0 };

/**
 * Fait passer ce joueur par la porte `id`: il arrive devant l'autre porte de la paire, tourné
 * vers son `facing`, à l'arrêt. Événement `door_passed` pour le fondu et le son. Faux si la paire
 * est incomplète (le chargement l'interdit) ou qu'aucune case n'est libre à l'arrivée.
 */
export function passDoor(sim: SimContext, player: PlayerIndex, id: string): boolean {
  const place = sim.content.places[sim.world.common.place];
  const target = place?.map.doors?.[id]?.to;
  const door = target === undefined ? undefined : place?.map.doors?.[target];
  const b = currentBlockers(sim.content, sim.world);
  if (place === undefined || target === undefined || door === undefined || b === null) return false;
  const facing = quarterAngle(door.facing);
  let x = Math.floor(door.x) + 0.5 + Math.cos(facing) * PLACES.arriveOffset;
  let y = Math.floor(door.y) + 0.5 + Math.sin(facing) * PLACES.arriveOffset;
  if (bodyCollides(b, x, y, sim.content.settings.movement.radius)) {
    if (!nearestFreeCell(b, x, y, spot)) return false;
    x = spot.x;
    y = spot.y;
  }
  const body = sim.world.players[player].body;
  body.x = x;
  body.y = y;
  body.facing = facing;
  body.speed = 0;
  sim.emit({
    type: 'door_passed',
    player,
    door: id,
    to: target,
    interior: interiorAt(place, x, y),
  });
  return true;
}
