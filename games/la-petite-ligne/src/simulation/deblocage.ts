/**
 * Personnages coincés (R01, soirée de jeu du 2026-11-01): les deux personnages étaient restés
 * pris après la pose d'un meuble. Trois garde-fous, tous côté hôte:
 * - la pose refuse un meuble qui couperait une case de la pièce de sa porte (`closesRoom`);
 * - « Débloquer mon personnage » (`unstick`) replace le joueur sur la case libre atteignable
 *   la plus proche, sinon devant la porte de la pièce, sinon devant la maison;
 * - au chargement, un personnage pris dans un obstacle est dégagé sans rien dire (`freeStuck`).
 * Les parcours se font de case en case (quatre voisins): le corps (rayon 0,3 m) passe par toute
 * case libre, et l'A* ne coupe jamais un coin entre deux cases bloquées.
 */
import { type GridFrame, cellIndex, cellX, cellY } from '../etat/carte';
import type { Cell, Character, Vec2 } from '../etat/types';
import { type Sim, emit, say } from './contexte';
import { standUp } from './bancs';
import { placeCharacter, refreshBlockers } from './deplacement';
import { type Blockers, bodyCollides, isBlockedCell, nearestFreeCell } from './grille';

const STEPS: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function indexOf(b: Blockers, cx: number, cy: number): number {
  return cellIndex(b.map, cx, cy);
}

/**
 * Cases atteignables depuis `from` (index de case), sans passer par les cases bloquées ni par
 * `extra`. `inside`, s'il est donné, borne le parcours (la pièce et sa porte).
 */
function reach(b: Blockers, from: Cell, extra: ReadonlySet<number>, inside: ((cx: number, cy: number) => boolean) | null): Set<number> {
  const seen = new Set<number>();
  const free = (cx: number, cy: number): boolean =>
    !isBlockedCell(b, cx, cy) && !extra.has(indexOf(b, cx, cy)) && (inside === null || inside(cx, cy));
  if (!free(from.cx, from.cy)) return seen;
  const queue: number[] = [indexOf(b, from.cx, from.cy)];
  seen.add(queue[0] ?? 0);
  // La file grandit pendant le parcours: `for...of` lit aussi les cases ajoutées.
  for (const i of queue) {
    const cx = cellX(b.map, i);
    const cy = cellY(b.map, i);
    for (const [dx, dy] of STEPS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!free(nx, ny)) continue;
      const ni = indexOf(b, nx, ny);
      if (seen.has(ni)) continue;
      seen.add(ni);
      queue.push(ni);
    }
  }
  return seen;
}

/** La pièce de la maisonnette et la case de sa porte. */
function inRoomOrDoor(sim: Sim): (cx: number, cy: number) => boolean {
  const { room, door } = sim.map.house;
  return (cx, cy) =>
    (cx === door.cx && cy === door.cy) || (cx >= room.x && cy >= room.y && cx < room.x + room.w && cy < room.y + room.h);
}

/**
 * Le meuble posé sur `cells` couperait-il de la porte une case de la pièce qui y menait ? Une
 * case déjà isolée (vieille sauvegarde) ne compte pas: seules celles qu'on perdrait.
 */
export function closesRoom(sim: Sim, cells: readonly Cell[]): boolean {
  const b = refreshBlockers(sim);
  const door = sim.map.house.door;
  const inside = inRoomOrDoor(sim);
  const extra = new Set(cells.map((k) => indexOf(b, k.cx, k.cy)));
  const before = reach(b, door, new Set(), inside);
  const after = reach(b, door, extra, inside);
  for (const i of before) if (!extra.has(i) && !after.has(i)) return true;
  return false;
}

/** Centre d'une case. */
function centre(i: number, grid: GridFrame): Vec2 {
  return { x: cellX(grid, i) + 0.5, y: cellY(grid, i) + 0.5 };
}

/** La case de `cells` la plus proche de `pos` (à égalité, la première dans l'ordre des cases). */
function nearest(cells: Iterable<number>, pos: Vec2, grid: GridFrame): Vec2 | null {
  let best: Vec2 | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  let bestI = Number.POSITIVE_INFINITY;
  for (const i of cells) {
    const at = centre(i, grid);
    const d = (at.x - pos.x) ** 2 + (at.y - pos.y) ** 2;
    if (d < bestD - 1e-9 || (Math.abs(d - bestD) <= 1e-9 && i < bestI)) {
      best = at;
      bestD = d;
      bestI = i;
    }
  }
  return best;
}

/**
 * Où dégager ce personnage: la case libre la plus proche d'où l'on rejoint le devant de la maison
 * (le bourg). Dans la pièce: la plus proche de la pièce reliée à sa porte, sinon devant la porte
 * de la pièce, sinon devant la maison.
 */
export function unstickSpot(sim: Sim, c: Character): Vec2 {
  const b = refreshBlockers(sim);
  const { room, door } = sim.map.house;
  const front = sim.map.points.house_door ?? { x: door.cx + 0.5, y: door.cy + 1.5 };
  const inRoom = c.pos.x >= room.x && c.pos.y >= room.y && c.pos.x < room.x + room.w && c.pos.y < room.y + room.h;
  if (inRoom) {
    const inside = inRoomOrDoor(sim);
    const cells = [...reach(b, door, new Set(), inside)].filter((i) => {
      const at = centre(i, b.map);
      return !(Math.floor(at.x) === door.cx && Math.floor(at.y) === door.cy);
    });
    const spot = nearest(cells, c.pos, b.map);
    if (spot !== null) return spot;
    // Pièce pleine: sur le seuil, sinon devant la maison.
    if (!isBlockedCell(b, door.cx, door.cy)) return { x: door.cx + 0.5, y: door.cy + 0.5 };
    return { x: front.x, y: front.y };
  }
  const seed = isBlockedCell(b, Math.floor(front.x), Math.floor(front.y)) ? nearestFreeCell(b, front) : front;
  if (seed === null) return { x: front.x, y: front.y };
  const town = reach(b, { cx: Math.floor(seed.x), cy: Math.floor(seed.y) }, new Set(), null);
  return nearest(town, c.pos, b.map) ?? { x: front.x, y: front.y };
}

/** Le personnage est-il pris: dans un obstacle, ou dans la pièce sans chemin jusqu'à sa porte ? */
export function isStuck(sim: Sim, c: Character): boolean {
  const b = refreshBlockers(sim);
  if (bodyCollides(b, c.pos.x, c.pos.y)) return true;
  const { room, door } = sim.map.house;
  const cx = Math.floor(c.pos.x);
  const cy = Math.floor(c.pos.y);
  const inRoom = cx >= room.x && cy >= room.y && cx < room.x + room.w && cy < room.y + room.h;
  if (!inRoom) return false;
  return !reach(b, door, new Set(), inRoomOrDoor(sim)).has(indexOf(b, cx, cy));
}

/**
 * « Débloquer mon personnage » (menu du carnet), validé par l'hôte: en journée, debout ou dans un
 * menu, ou en train de porter (la charge est alors posée). Renvoie vrai s'il a été replacé.
 */
export function unstick(sim: Sim, c: Character): boolean {
  if (sim.world.phase !== 'day' || !c.created || sim.world.scene !== null) return false;
  if (c.status !== 'active' && c.status !== 'menu' && c.status !== 'gesture') return false;
  if (c.seat !== null) standUp(sim, c);
  const beam = sim.world.beam;
  if (beam?.carried === true && beam.holders.includes(c.id)) {
    beam.carried = false;
    beam.holders = [];
    for (const other of sim.world.characters) {
      if (other.status === 'gesture') other.status = 'active';
      if (other.action.kind === 'carry') other.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
    }
    emit(sim, { type: 'beam_dropped' });
  }
  if (c.status === 'gesture') c.status = 'active';
  c.placement = null;
  c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
  placeCharacter(sim, c, unstickSpot(sim, c));
  sim.runtime.changed = true;
  say(sim, c.id, 'unstuck');
  return true;
}

/** Au chargement d'une partie: qui est pris (vieille sauvegarde) est dégagé sans un mot. */
export function freeStuck(sim: Sim): void {
  for (const c of sim.world.characters) {
    if (!c.created || c.bedId !== null || c.seat !== null) continue;
    if (isStuck(sim, c)) placeCharacter(sim, c, unstickSpot(sim, c));
  }
}
