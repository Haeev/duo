/**
 * Portes et intérieurs (ADR 0016, 0022). Un intérieur est posé sur la grille du lieu, dans
 * l'annexe sous le dehors; on y entre par une paire de portes. Franchir une porte, c'est être
 * replacé à l'autre porte de la paire, tourné vers son `facing`: aucun état nouveau, la position
 * dit où l'on est. Chaque joueur a donc son intérieur, ou le dehors, indépendamment de l'autre.
 *
 * On passe en franchissant le seuil (`donnees/seuils.ts`), ou par la touche d'action sur l'objet
 * visible de la porte (brique `passage`); on arrive devant l'autre porte, tourné vers la pièce.
 */
import type { PlaceContent } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { DoorDef } from '../../donnees/schemas/lieu';
import { DOORS, doorSills, type Sill } from '../../donnees/seuils';
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

const sillCache = new WeakMap<PlaceContent, Readonly<Record<string, Sill>>>();

/** Les seuils des portes du lieu (calculés une fois: la carte ne change pas). */
export function sillsOf(place: PlaceContent): Readonly<Record<string, Sill>> {
  let sills = sillCache.get(place);
  if (sills === undefined) {
    sills = doorSills(place.map, DOORS.width);
    sillCache.set(place, sills);
  }
  return sills;
}

/**
 * La porte à passer en marchant dont ce corps franchit le seuil, `null` sinon. Porte dans un mur:
 * le corps touche le mur dans la largeur du passage et avance vers lui. Porte au sol: le corps est
 * au milieu de sa case et avance vers son centre. `wants`: le joueur donne une direction (contre
 * un mur la vitesse tombe, pas l'intention). On ne repasse pas une porte dont on vient de sortir,
 * puisqu'on en sort le dos tourné.
 */
export function touchedDoor(
  place: PlaceContent,
  body: Body,
  radius: number,
  wants: boolean,
): string | null {
  const doors = place.map.doors;
  if (doors === undefined || !wants) return null;
  const sills = sillsOf(place);
  const fx = Math.cos(body.facing);
  const fy = Math.sin(body.facing);
  const heading = Math.cos((PLACES.sillHeadingDeg * Math.PI) / 180);
  for (const id in doors) {
    const door = doors[id];
    const sill = sills[id];
    if (door === undefined || sill === undefined || (door.enter ?? 'walk') !== 'walk') continue;
    const dx = body.x - sill.x;
    const dy = body.y - sill.y;
    if (sill.kind === 'floor') {
      if (Math.max(Math.abs(dx), Math.abs(dy)) > PLACES.floorDoorReach) continue;
      if (dx * fx + dy * fy > 0) continue;
      return id;
    }
    const depth = dx * sill.nx + dy * sill.ny;
    const side = Math.abs(dx * sill.ny - dy * sill.nx);
    if (depth < 0 || depth > radius + PLACES.sillReach || side > sill.halfWidth) continue;
    if (fx * sill.nx + fy * sill.ny > -heading) continue;
    return id;
  }
  return null;
}

const spot: Vec2 = { x: 0, y: 0 };

/**
 * Fait passer ce joueur par la porte `id`: il arrive devant l'autre porte de la paire (à
 * `arriveOffset` de son seuil), tourné vers son `facing`, à l'arrêt. Événement `door_passed` pour le fondu et le son. Faux si la paire
 * est incomplète (le chargement l'interdit) ou qu'aucune case n'est libre à l'arrivée.
 */
export function passDoor(sim: SimContext, player: PlayerIndex, id: string): boolean {
  const place = sim.content.places[sim.world.common.place];
  const target = place?.map.doors?.[id]?.to;
  const door = target === undefined ? undefined : place?.map.doors?.[target];
  const b = currentBlockers(sim.content, sim.world);
  if (place === undefined || target === undefined || door === undefined || b === null) return false;
  const sill = sillsOf(place)[target];
  if (sill === undefined) return false;
  const facing = quarterAngle(door.facing);
  const offset = sill.kind === 'floor' ? PLACES.floorArriveOffset : PLACES.arriveOffset;
  let x = sill.x + sill.nx * offset;
  let y = sill.y + sill.ny * offset;
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
