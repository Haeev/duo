/**
 * Le seuil d'une porte: où elle se trouve vraiment sur la grille, d'après sa case et les murs
 * autour. Règle générale, lue dans la carte seule, pour tout lieu:
 *
 * - la case de la porte est un mur (porte percée dans une cloison): le seuil est le bord de cette
 *   case du côté où l'on arrive (`facing`);
 * - sinon, la case derrière elle est un mur (porte d'une façade, vue du dehors ou du dedans): le
 *   seuil est le bord de la case de la porte contre ce mur;
 * - sinon, c'est une porte au sol (escalier, trappe): le seuil est le milieu de sa case.
 *
 * La simulation s'en sert pour le passage (on passe en franchissant le seuil, pas avant) et pour
 * l'arrivée (devant la porte, tourné vers la pièce); le rendu, pour dessiner la porte à sa place.
 * Logique pure, sans état.
 */
import type { DoorDef, MapDef, MapObject } from './schemas/lieu';
import type { PropDef } from './schemas/meuble';

/**
 * Réglages des seuils, en attente de leur place dans `reglages.json`: le meuble posé d'office au
 * seuil d'une porte sans objet (`commun/meubles/<prop>.json`) et la largeur d'un passage (m).
 */
export const DOORS = { prop: 'porte', width: 1 } as const;

export interface Sill {
  /** `wall`: dans un mur; `floor`: au sol, sans mur derrière. */
  readonly kind: 'wall' | 'floor';
  /** Milieu du seuil (m). */
  readonly x: number;
  readonly y: number;
  /** Vers la pièce où l'on arrive par cette porte (unitaire, x est, y sud). */
  readonly nx: number;
  readonly ny: number;
  /** Demi-largeur du passage (m). */
  readonly halfWidth: number;
}

/** Pas d'un quart de tour (`facing`): 0 sud, 1 est, 2 nord, 3 ouest. */
const AHEAD = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
] as const;

/** Le seuil de `door`; `isWall(cx, cy)`: cette case est un mur de la carte (meubles exclus). */
export function doorSill(
  isWall: (cx: number, cy: number) => boolean,
  door: Pick<DoorDef, 'x' | 'y' | 'facing' | 'width'>,
  defaultWidth: number,
): Sill {
  const cx = Math.floor(door.x);
  const cy = Math.floor(door.y);
  const [nx, ny] = AHEAD[door.facing];
  const halfWidth = (door.width ?? defaultWidth) / 2;
  const centre = { x: cx + 0.5, y: cy + 0.5 };
  if (isWall(cx, cy))
    return { kind: 'wall', x: centre.x + nx / 2, y: centre.y + ny / 2, nx, ny, halfWidth };
  if (isWall(cx - nx, cy - ny))
    return { kind: 'wall', x: centre.x - nx / 2, y: centre.y - ny / 2, nx, ny, halfWidth };
  return { kind: 'floor', ...centre, nx, ny, halfWidth };
}

/** Les murs d'une carte (`blocked`), pour `doorSill` hors de la simulation (chargement, rendu). */
export function wallTest(
  map: Pick<MapDef, 'width' | 'height' | 'blocked'>,
): (cx: number, cy: number) => boolean {
  const { width, height } = map;
  const cells = new Uint8Array(width * height);
  for (const r of map.blocked)
    for (let y = Math.max(0, r.y); y < Math.min(height, r.y + r.h); y++)
      for (let x = Math.max(0, r.x); x < Math.min(width, r.x + r.w); x++) cells[y * width + x] = 1;
  return (cx, cy) =>
    cx < 0 || cy < 0 || cx >= width || cy >= height || cells[cy * width + cx] === 1;
}

/** Tous les seuils d'une carte, par identifiant de porte. */
export function doorSills(
  map: Pick<MapDef, 'width' | 'height' | 'blocked' | 'doors'>,
  defaultWidth: number,
): Record<string, Sill> {
  const isWall = wallTest(map);
  const out: Record<string, Sill> = {};
  for (const [id, door] of Object.entries(map.doors ?? {}))
    out[id] = doorSill(isWall, door, defaultWidth);
  return out;
}

/** Identifiant de l'objet visible posé d'office au seuil de la porte `id`. */
export function sillObjectId(id: string): string {
  return `s-${id}`;
}

/**
 * La carte, avec un objet visible au seuil de chaque porte qui n'en nomme pas (`object`): le
 * meuble `prop` (brique `passage`), posé au milieu du seuil et tourné vers la pièce. La porte
 * devient ainsi une cible de la touche d'action, montrée avant d'agir, sans que les cartes aient à
 * l'écrire. Sans ce meuble dans le contenu, ou pour un identifiant trop long: la carte telle quelle.
 */
export function withSillObjects(
  map: MapDef,
  props: Readonly<Record<string, PropDef>>,
  prop: string,
  defaultWidth: number,
): MapDef {
  const doors = map.doors;
  if (doors === undefined || props[prop] === undefined) return map;
  const sills = doorSills(map, defaultWidth);
  const objects: MapObject[] = [...map.objects];
  const taken = new Set(objects.map((o) => o.id));
  const named: Record<string, DoorDef> = {};
  for (const [id, door] of Object.entries(doors)) {
    const sill = sills[id];
    const object = sillObjectId(id);
    if (
      door.object !== undefined ||
      sill === undefined ||
      object.length > 40 ||
      taken.has(object)
    ) {
      named[id] = door;
      continue;
    }
    objects.push({ id: object, type: prop, x: sill.x, y: sill.y, rotation: door.facing });
    named[id] = { ...door, object };
  }
  return objects.length === map.objects.length ? map : { ...map, objects, doors: named };
}
