/**
 * Objets muraux de la maisonnette (retours R15 et R17 du 2026-11-03): un cadre, une horloge ou le
 * râtelier prend une place sur un mur, pas une case du sol. Il n'est refusé que par une fenêtre,
 * une porte, un autre objet mural à cet endroit du mur, ou un meuble plus haut que la hauteur de
 * pose (`blocksWall`: étagère, poêle et son tuyau). Le mobilier bas devant le mur ne le gêne pas.
 *
 * Pur (ni DOM ni Three.js): la simulation valide la pose avec ces règles, le rendu y lit la place
 * exacte de l'objet le long du mur. Si sa case tombe trop près d'une fenêtre, d'une porte ou d'un
 * coin, l'objet glisse le long du mur, d'au plus `WALL_SLIDE` m, jusqu'au premier pan libre.
 */
import type { Content } from '../donnees/types';
import type { WindowSide } from '../donnees/maison';
import type { GameMap, MapRoom, Rect } from './carte';
import { activeHouseRooms, houseRoomAt, windowsNow } from './maison';
import type { Cell, DeepReadonly, PlacedFurniture, WorldState } from './types';

/** Mur d'une pièce, comme le quart de rotation d'un objet dos à lui: 0 nord, 1 ouest, 2 sud, 3 est. */
export type WallQuarter = 0 | 1 | 2 | 3;

const SIDE_QUARTER: Readonly<Record<WindowSide, WallQuarter>> = { north: 0, west: 1, south: 2, east: 3 };

/** Cadre d'une fenêtre de part et d'autre de son ouverture (chambranle du modèle, m). */
export const WINDOW_FRAME = 0.12;
/** Jeu laissé contre un coin de la pièce (épaisseur de l'enduit, m). */
export const CORNER_GAP = 0.05;
/** Glissement le plus long le long du mur pour trouver un pan libre (m), et son pas. */
export const WALL_SLIDE = 0.5;
const SLIDE_STEP = 0.05;

/** Place d'un objet sur un mur: pièce, mur, étendue le long du mur (x pour nord et sud, y sinon). */
export interface WallSpan {
  room: string;
  quarter: WallQuarter;
  from: number;
  to: number;
  /** Milieu le long du mur. */
  center: number;
}

export type WallProblem = 'wall' | 'wall_opening' | 'overlap';

type ReadWorld = DeepReadonly<Pick<WorldState, 'furniture' | 'rooms'>>;

/** Murs que touche la case (bord de la pièce), le voulu d'abord s'il en fait partie. */
export function wallQuarterOf(room: Rect, cell: Cell, wanted: number): WallQuarter | null {
  const walls: WallQuarter[] = [];
  if (cell.cy === room.y) walls.push(0);
  if (cell.cx === room.x) walls.push(1);
  if (cell.cx === room.x + room.w - 1) walls.push(3);
  if (cell.cy === room.y + room.h - 1) walls.push(2);
  const turn = (((wanted % 4) + 4) % 4) as WallQuarter;
  return walls.includes(turn) ? turn : (walls[0] ?? null);
}

/** Étendue d'une pièce le long d'un de ses murs. */
function wallLimits(room: Rect, quarter: WallQuarter): { min: number; max: number } {
  return quarter === 0 || quarter === 2 ? { min: room.x, max: room.x + room.w } : { min: room.y, max: room.y + room.h };
}

/** Fenêtres (cadre compris) et portes de ce mur, le long du mur. */
export function wallOpenings(
  content: Content,
  map: GameMap,
  world: ReadWorld,
  room: MapRoom,
  quarter: WallQuarter,
): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  const horizontal = quarter === 0 || quarter === 2;
  for (const w of windowsNow(content, map, world.rooms)) {
    if (w.room !== room.id || SIDE_QUARTER[w.side] !== quarter) continue;
    const along = horizontal ? w.x : w.y;
    out.push({ from: along - w.width / 2 - WINDOW_FRAME, to: along + w.width / 2 + WINDOW_FRAME });
  }
  const r = room.rect;
  // Case de porte posée juste derrière ce mur: porte de la maison, portes des pièces bâties.
  const onWall = (cell: Cell): boolean => {
    switch (quarter) {
      case 0:
        return cell.cy === r.y - 1 && cell.cx >= r.x && cell.cx < r.x + r.w;
      case 2:
        return cell.cy === r.y + r.h && cell.cx >= r.x && cell.cx < r.x + r.w;
      case 1:
        return cell.cx === r.x - 1 && cell.cy >= r.y && cell.cy < r.y + r.h;
      case 3:
        return cell.cx === r.x + r.w && cell.cy >= r.y && cell.cy < r.y + r.h;
    }
  };
  const doors: Cell[] = [];
  for (const building of Object.values(map.buildings)) {
    for (const door of building.doors) doors.push(door.cell);
  }
  for (const active of activeHouseRooms(map, world.rooms)) {
    if (active.build !== null) doors.push(active.build.door.cell);
  }
  for (const cell of doors) {
    if (!onWall(cell)) continue;
    const along = horizontal ? cell.cx : cell.cy;
    out.push({ from: along, to: along + 1 });
  }
  return out;
}

/**
 * Place la plus proche de `center` où une étendue de `width` tient entre les coins sans toucher
 * aucune ouverture, à `WALL_SLIDE` m au plus; `null` s'il n'y en a pas.
 */
export function fitAlongWall(
  limits: { min: number; max: number },
  center: number,
  width: number,
  openings: readonly { from: number; to: number }[],
): { from: number; to: number; center: number } | null {
  const steps = Math.round(WALL_SLIDE / SLIDE_STEP);
  for (let k = 0; k <= steps; k += 1) {
    for (const sign of k === 0 ? [1] : [-1, 1]) {
      const c = center + sign * k * SLIDE_STEP;
      const from = c - width / 2;
      const to = c + width / 2;
      if (from < limits.min + CORNER_GAP - 1e-9 || to > limits.max - CORNER_GAP + 1e-9) continue;
      if (openings.some((o) => from < o.to && to > o.from)) continue;
      return { from, to, center: c };
    }
  }
  return null;
}

/** Place d'un objet mural (sa case, sa rotation voulue), sans regarder les autres objets: ou pourquoi il ne tient pas. */
export function wallSpanOf(
  content: Content,
  map: GameMap,
  world: ReadWorld,
  item: string,
  cell: Cell,
  rotation: number,
): WallSpan | WallProblem {
  const def = content.items[item];
  const room = houseRoomAt(map, world.rooms, cell.cx + 0.5, cell.cy + 0.5);
  if (def === undefined || room === null) return 'wall';
  const quarter = wallQuarterOf(room.rect, cell, rotation);
  if (quarter === null) return 'wall';
  const center = quarter === 0 || quarter === 2 ? cell.cx + 0.5 : cell.cy + 0.5;
  const fit = fitAlongWall(wallLimits(room.rect, quarter), center, def.wallWidth, wallOpenings(content, map, world, room, quarter));
  if (fit === null) return 'wall_opening';
  return { room: room.id, quarter, ...fit };
}

/**
 * Pose d'un objet mural: sa place, ou pourquoi elle est refusée (pas contre un mur, sur une fenêtre
 * ou une porte, sur un autre objet mural ou au-dessus d'un meuble haut). `ignore`: l'objet déplacé.
 */
export function wallPlacement(
  content: Content,
  map: GameMap,
  world: ReadWorld,
  item: string,
  cell: Cell,
  rotation: number,
  ignore: string | null = null,
): WallSpan | WallProblem {
  const span = wallSpanOf(content, map, world, item, cell, rotation);
  if (typeof span === 'string') return span;
  const room = activeHouseRooms(map, world.rooms).find((r) => r.id === span.room);
  if (room === undefined) return 'wall';
  for (const f of world.furniture) {
    if (f.id === ignore || f.window !== undefined) continue;
    const other = content.items[f.item];
    if (other === undefined || other.footprint === null) continue;
    if (other.wall) {
      const theirs = wallSpanOf(content, map, world, f.item, f.cell, f.rotation);
      if (typeof theirs !== 'string' && theirs.room === span.room && theirs.quarter === span.quarter && overlaps(span, theirs)) return 'overlap';
      continue;
    }
    if (other.blocksWall && tallAgainst(room.rect, span, f, other.footprint)) return 'overlap';
  }
  return span;
}

function overlaps(a: { from: number; to: number }, b: { from: number; to: number }): boolean {
  return a.from < b.to && a.to > b.from;
}

/** Un meuble haut dont une case touche ce mur, sous l'étendue de l'objet. */
function tallAgainst(
  room: Rect,
  span: WallSpan,
  f: DeepReadonly<PlacedFurniture>,
  footprint: { w: number; d: number },
): boolean {
  const turned = f.rotation % 2 === 1;
  const w = turned ? footprint.d : footprint.w;
  const d = turned ? footprint.w : footprint.d;
  const x0 = f.cell.cx;
  const y0 = f.cell.cy;
  switch (span.quarter) {
    case 0:
      return y0 === room.y && overlaps(span, { from: x0, to: x0 + w });
    case 2:
      return y0 + d === room.y + room.h && overlaps(span, { from: x0, to: x0 + w });
    case 1:
      return x0 === room.x && overlaps(span, { from: y0, to: y0 + d });
    case 3:
      return x0 + w === room.x + room.w && overlaps(span, { from: y0, to: y0 + d });
  }
}
