/**
 * Collisions maison sur la grille (cases de 1 m) et recherche de chemin (A*).
 * Déterministe: mêmes entrées, même résultat, dans Node comme dans Chromium.
 * Le même code sert à l'hôte et à la prédiction de l'invité.
 */
import type { GameMap } from '../etat/carte';
import type { Vec2 } from '../etat/types';
import { BODY_RADIUS, CORNER_NUDGE_MAX, CORNER_NUDGE_STEP } from './constantes';

/**
 * Ce qui bloque: la carte, plus une couche dynamique (arbres debout, meubles, murs des pièces
 * bâties: 1; portes fermées: code de leur bâtiment, 2 et plus, voir `simulation/interieurs.ts`;
 * porte percée d'une pièce bâtie: `OPENED_CELL`, ouverte malgré la carte).
 */
export interface Blockers {
  readonly map: GameMap;
  readonly dynamic: Uint8Array;
  /**
   * Porte fermée qu'on passe quand même: celle du bâtiment où l'on est (sortie toujours permise),
   * -1 pour toutes (habitants). Absent ou 0: aucune.
   */
  readonly door?: number;
  /** Cases passables que ce corps évite quand même (1): le gué de pierres du ru pour un habitant adulte. */
  readonly avoid?: Uint8Array;
}

/** Couche dynamique: case ouverte malgré la carte (porte percée d'une pièce bâtie, tour 10). */
export const OPENED_CELL = 255;

export function isBlockedCell(b: Blockers, cx: number, cy: number): boolean {
  const { map } = b;
  if (cx < 0 || cy < 0 || cx >= map.width || cy >= map.height) return true;
  const i = cy * map.width + cx;
  if (b.avoid?.[i] === 1) return true;
  const d = b.dynamic[i] ?? 0;
  if (d === OPENED_CELL) return false;
  if (map.blocked[i] === true) return true;
  if (d <= 1) return d === 1;
  return b.door !== -1 && b.door !== d;
}

/** Le disque du corps en (x, y) touche-t-il une case bloquée ? */
export function bodyCollides(b: Blockers, x: number, y: number, radius = BODY_RADIUS): boolean {
  const minX = Math.floor(x - radius);
  const maxX = Math.floor(x + radius);
  const minY = Math.floor(y - radius);
  const maxY = Math.floor(y + radius);
  for (let cy = minY; cy <= maxY; cy++) {
    for (let cx = minX; cx <= maxX; cx++) {
      if (!isBlockedCell(b, cx, cy)) continue;
      // Distance du centre au carré de la case.
      const nx = Math.max(cx, Math.min(x, cx + 1));
      const ny = Math.max(cy, Math.min(y, cy + 1));
      const dx = x - nx;
      const dy = y - ny;
      if (dx * dx + dy * dy < radius * radius) return true;
    }
  }
  return false;
}

/**
 * Enfoncement du disque dans les cases bloquées: somme des carrés de ce qui dépasse dans chacune.
 * Glisser à l'intérieur d'une seule case ne le change pas; toucher une seconde case l'augmente.
 */
function overlap(b: Blockers, x: number, y: number, radius = BODY_RADIUS): number {
  let total = 0;
  for (let cy = Math.floor(y - radius); cy <= Math.floor(y + radius); cy++) {
    for (let cx = Math.floor(x - radius); cx <= Math.floor(x + radius); cx++) {
      if (!isBlockedCell(b, cx, cy)) continue;
      const nx = Math.max(cx, Math.min(x, cx + 1));
      const ny = Math.max(cy, Math.min(y, cy + 1));
      const d = Math.hypot(x - nx, y - ny);
      if (d < radius) total += (radius - d) ** 2;
    }
  }
  return total;
}

/**
 * Déplace `pos` de (dx, dy) en glissant le long des obstacles (axe par axe).
 * Modifie `pos` en place, sans allocation.
 */
export function moveBody(b: Blockers, pos: Vec2, dx: number, dy: number): void {
  // Déjà pris dans un obstacle (posé sur soi, train, vieille sauvegarde): tout pas qui ne
  // s'enfonce pas est permis, sinon le personnage resterait figé (R01).
  if (bodyCollides(b, pos.x, pos.y)) {
    const nx = pos.x + dx;
    const ny = pos.y + dy;
    if (overlap(b, nx, ny) <= overlap(b, pos.x, pos.y) + 1e-12) {
      pos.x = nx;
      pos.y = ny;
    }
    return;
  }
  if (dx !== 0) {
    const nx = pos.x + dx;
    if (!bodyCollides(b, nx, pos.y)) pos.x = nx;
    else if (Math.abs(dx) >= Math.abs(dy)) nudgeY(b, pos, nx, Math.abs(dx), dy);
  }
  if (dy !== 0) {
    const ny = pos.y + dy;
    if (!bodyCollides(b, pos.x, ny)) pos.y = ny;
    else if (Math.abs(dy) > Math.abs(dx)) nudgeX(b, pos, ny, Math.abs(dy), dx);
  }
}

/** Bloqué sur x: le plus petit décalage en y qui libère le passage en `nx`; on glisse de ce côté d'au plus `step`. */
function nudgeY(b: Blockers, pos: Vec2, nx: number, step: number, hint: number): void {
  const first = hint < 0 ? -1 : 1;
  for (let o = CORNER_NUDGE_STEP; o <= CORNER_NUDGE_MAX + 1e-9; o += CORNER_NUDGE_STEP) {
    for (let k = 0; k < 2; k++) {
      const side = k === 0 ? first : -first;
      if (bodyCollides(b, nx, pos.y + side * o)) continue;
      const ny = pos.y + side * Math.min(o, step);
      if (!bodyCollides(b, pos.x, ny)) pos.y = ny;
      return;
    }
  }
}

/** Bloqué sur y: même chose en x. */
function nudgeX(b: Blockers, pos: Vec2, ny: number, step: number, hint: number): void {
  const first = hint < 0 ? -1 : 1;
  for (let o = CORNER_NUDGE_STEP; o <= CORNER_NUDGE_MAX + 1e-9; o += CORNER_NUDGE_STEP) {
    for (let k = 0; k < 2; k++) {
      const side = k === 0 ? first : -first;
      if (bodyCollides(b, pos.x + side * o, ny)) continue;
      const nx = pos.x + side * Math.min(o, step);
      if (!bodyCollides(b, nx, pos.y)) pos.x = nx;
      return;
    }
  }
}

/** Case libre la plus proche d'un point (pour viser un point bloqué: un comptoir, un puits). */
export function nearestFreeCell(b: Blockers, target: Vec2): Vec2 | null {
  const tx = Math.floor(target.x);
  const ty = Math.floor(target.y);
  for (let r = 0; r < 6; r++) {
    let best: Vec2 | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (let cy = ty - r; cy <= ty + r; cy++) {
      for (let cx = tx - r; cx <= tx + r; cx++) {
        if (Math.max(Math.abs(cx - tx), Math.abs(cy - ty)) !== r) continue;
        if (isBlockedCell(b, cx, cy)) continue;
        const d = Math.hypot(cx + 0.5 - target.x, cy + 0.5 - target.y);
        if (d < bestD) {
          bestD = d;
          best = { x: cx + 0.5, y: cy + 0.5 };
        }
      }
    }
    if (best !== null) return best;
  }
  return null;
}

const NEIGHBOURS: readonly [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/**
 * Chemin de case en case de `from` à `to` (A* à 8 voisins, sans couper les
 * coins). Renvoie les centres des cases à suivre, `to` exact en dernier, ou
 * `null` si rien ne relie les deux. Si `to` est bloqué, vise la case libre la
 * plus proche.
 */
export function findPath(b: Blockers, from: Vec2, to: Vec2, maxNodes = 4000): Vec2[] | null {
  const { map } = b;
  const w = map.width;
  let goal = to;
  if (isBlockedCell(b, Math.floor(to.x), Math.floor(to.y))) {
    const free = nearestFreeCell(b, to);
    if (free === null) return null;
    goal = free;
  }
  const sx = Math.floor(from.x);
  const sy = Math.floor(from.y);
  const gx = Math.floor(goal.x);
  const gy = Math.floor(goal.y);
  if (sx === gx && sy === gy) return [{ x: goal.x, y: goal.y }];

  const size = w * map.height;
  const gScore = new Float64Array(size).fill(Number.POSITIVE_INFINITY);
  const came = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const start = sy * w + sx;
  const goalIndex = gy * w + gx;
  gScore[start] = 0;
  // Tas binaire minimal sur f = g + h.
  const heapNodes: number[] = [start];
  const heapF: number[] = [Math.hypot(gx - sx, gy - sy)];
  const push = (node: number, f: number): void => {
    heapNodes.push(node);
    heapF.push(f);
    let i = heapNodes.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if ((heapF[parent] ?? 0) <= f) break;
      heapNodes[i] = heapNodes[parent] ?? 0;
      heapF[i] = heapF[parent] ?? 0;
      i = parent;
    }
    heapNodes[i] = node;
    heapF[i] = f;
  };
  const pop = (): number => {
    const top = heapNodes[0] ?? -1;
    const lastNode = heapNodes.pop() ?? -1;
    const lastF = heapF.pop() ?? 0;
    if (heapNodes.length > 0) {
      let i = 0;
      const n = heapNodes.length;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        let smallestF = lastF;
        if (l < n && (heapF[l] ?? 0) < smallestF) {
          smallest = l;
          smallestF = heapF[l] ?? 0;
        }
        if (r < n && (heapF[r] ?? 0) < smallestF) smallest = r;
        if (smallest === i) break;
        heapNodes[i] = heapNodes[smallest] ?? 0;
        heapF[i] = heapF[smallest] ?? 0;
        i = smallest;
      }
      heapNodes[i] = lastNode;
      heapF[i] = lastF;
    }
    return top;
  };

  let expanded = 0;
  let found = false;
  while (heapNodes.length > 0 && expanded < maxNodes) {
    const current = pop();
    if (current === goalIndex) {
      found = true;
      break;
    }
    if (closed[current] === 1) continue;
    closed[current] = 1;
    expanded++;
    const cx = current % w;
    const cy = (current - cx) / w;
    const g = gScore[current] ?? 0;
    for (const [ox, oy, cost] of NEIGHBOURS) {
      const nx = cx + ox;
      const ny = cy + oy;
      if (isBlockedCell(b, nx, ny)) continue;
      if (ox !== 0 && oy !== 0 && (isBlockedCell(b, cx + ox, cy) || isBlockedCell(b, cx, cy + oy))) continue;
      const ni = ny * w + nx;
      if (closed[ni] === 1) continue;
      const tentative = g + cost;
      if (tentative < (gScore[ni] ?? Number.POSITIVE_INFINITY)) {
        gScore[ni] = tentative;
        came[ni] = current;
        push(ni, tentative + Math.hypot(gx - nx, gy - ny));
      }
    }
  }
  if (!found) return null;
  const cells: number[] = [];
  for (let n = goalIndex; n !== start && n !== -1; n = came[n] ?? -1) cells.push(n);
  cells.reverse();
  const path = cells.map((n) => ({ x: (n % w) + 0.5, y: Math.floor(n / w) + 0.5 }));
  const last = path[path.length - 1];
  if (last !== undefined) {
    last.x = goal.x;
    last.y = goal.y;
  }
  return simplifyPath(b, from, path);
}

/** Vrai si un corps peut aller en ligne droite de a à b (échantillonnage tous les 25 cm). */
export function clearLine(b: Blockers, a: Vec2, c: Vec2): boolean {
  const d = Math.hypot(c.x - a.x, c.y - a.y);
  const steps = Math.ceil(d / 0.25);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (bodyCollides(b, a.x + (c.x - a.x) * t, a.y + (c.y - a.y) * t)) return false;
  }
  return true;
}

/** Retire les points intermédiaires quand la ligne droite passe (trajets moins anguleux). */
function simplifyPath(b: Blockers, from: Vec2, path: Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  let anchor = from;
  let i = 0;
  while (i < path.length) {
    let j = path.length - 1;
    while (j > i) {
      const candidate = path[j];
      if (candidate !== undefined && clearLine(b, anchor, candidate)) break;
      j--;
    }
    const next = path[j];
    if (next === undefined) break;
    out.push(next);
    anchor = next;
    i = j + 1;
  }
  return out;
}
