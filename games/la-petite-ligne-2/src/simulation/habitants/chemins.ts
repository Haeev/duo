/**
 * Chemins des habitants. Sur le graphe des chemins du lieu quand la carte en a un (`map.graph`,
 * tiré du plan: nœuds et arêtes), sinon sur la grille. Les portes (brique `open`) se franchissent
 * toujours: l'habitant les ouvre; le passage part en événement pour le rendu et le son. Appelé
 * au changement de ligne du planning, jamais à chaque pas.
 */
import type { Content, PlaceContent } from '../../donnees/charger';
import type { ReadPlace } from '../noyau/obstacles';
import { footprintOf } from '../noyau/obstacles';

/** Un trajet: suite de points (m), et les portes franchies avec l'index du point qui les passe. */
export interface Route {
  readonly points: readonly { readonly x: number; readonly y: number }[];
  readonly doors: readonly { readonly at: number; readonly id: string }[];
}

interface Grid {
  readonly width: number;
  readonly height: number;
  /** 1: on ne passe pas (mur, eau, meuble solide qui n'est pas une porte). */
  readonly blocked: Uint8Array;
  /** Porte qui couvre la case, ou `undefined`. */
  readonly doors: (string | undefined)[];
}

const grids = new WeakMap<PlaceContent, { grid: Grid; signature: number }>();

/** Empreinte des meubles posés par les joueurs: la grille se refait quand l'un bouge. */
function placedSignature(state: ReadPlace): number {
  let h = state.placed.length;
  for (const p of state.placed)
    h = (Math.imul(h, 31) + Math.round(p.x * 16) * 7 + Math.round(p.y * 16) * 13 + p.rotation) | 0;
  return h;
}

const EDGE = 1e-6;

/** Grille des habitants: la carte, plus les meubles solides; les portes restent franchissables. */
function gridOf(content: Content, place: PlaceContent, state: ReadPlace): Grid {
  const signature = placedSignature(state);
  const cached = grids.get(place);
  if (cached?.signature === signature) return cached.grid;
  const { width, height } = place.map;
  const blocked = new Uint8Array(width * height);
  const doors: (string | undefined)[] = new Array<string | undefined>(width * height);
  for (const r of place.map.blocked)
    for (let cy = Math.max(0, r.y); cy < Math.min(height, r.y + r.h); cy++)
      for (let cx = Math.max(0, r.x); cx < Math.min(width, r.x + r.w); cx++)
        blocked[cy * width + cx] = 1;
  for (const prop of [...place.map.objects, ...state.placed]) {
    const def = content.props[prop.type];
    if (!def?.solid) continue;
    const isDoor = def.bricks.some((b) => b.brick === 'open');
    const size = footprintOf(def, prop.rotation);
    for (
      let cy = Math.floor(prop.y - size.h / 2 + EDGE);
      cy <= Math.floor(prop.y + size.h / 2 - EDGE);
      cy++
    )
      for (
        let cx = Math.floor(prop.x - size.w / 2 + EDGE);
        cx <= Math.floor(prop.x + size.w / 2 - EDGE);
        cx++
      ) {
        if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
        if (isDoor) doors[cy * width + cx] = prop.id;
        else blocked[cy * width + cx] = 1;
      }
  }
  const grid: Grid = { width, height, blocked, doors };
  grids.set(place, { grid, signature });
  return grid;
}

function free(g: Grid, cx: number, cy: number): boolean {
  return cx >= 0 && cy >= 0 && cx < g.width && cy < g.height && g.blocked[cy * g.width + cx] !== 1;
}

/** Case libre la plus proche (anneaux croissants), -1 si aucune à 8 cases. */
function nearestFree(g: Grid, x: number, y: number): number {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  for (let r = 0; r <= 8; r++)
    for (let cy = ty - r; cy <= ty + r; cy++)
      for (let cx = tx - r; cx <= tx + r; cx++) {
        if (Math.max(Math.abs(cx - tx), Math.abs(cy - ty)) !== r) continue;
        if (free(g, cx, cy)) return cy * g.width + cx;
      }
  return -1;
}

const NEIGHBOURS: readonly (readonly [number, number, number])[] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/** A* sur la grille, 8 voisins, sans couper les coins. Déterministe (égalités départagées par l'index). */
function gridRoute(g: Grid, fx: number, fy: number, tx: number, ty: number): Route | null {
  const start = nearestFree(g, fx, fy);
  const goal = nearestFree(g, tx, ty);
  if (start < 0 || goal < 0) return null;
  const n = g.width * g.height;
  const cost = new Float64Array(n).fill(Number.POSITIVE_INFINITY);
  const from = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const gx = goal % g.width;
  const gy = (goal - gx) / g.width;
  const h = (i: number): number => {
    const x = i % g.width;
    return Math.hypot(x - gx, (i - x) / g.width - gy);
  };
  // File de priorité minimale (tas binaire) sur f = coût + heuristique.
  const heap: number[] = [];
  const score = new Float64Array(n);
  const push = (i: number): void => {
    heap.push(i);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      const a = heap[p] ?? 0;
      const b = heap[k] ?? 0;
      if ((score[a] ?? 0) < (score[b] ?? 0) || ((score[a] ?? 0) === (score[b] ?? 0) && a < b))
        break;
      heap[p] = b;
      heap[k] = a;
      k = p;
    }
  };
  const pop = (): number => {
    const top = heap[0] ?? -1;
    const last = heap.pop() ?? -1;
    if (heap.length > 0) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        for (const c of [l, r]) {
          if (c >= heap.length) continue;
          const ci = heap[c] ?? 0;
          const mi = heap[m] ?? 0;
          if (
            (score[ci] ?? 0) < (score[mi] ?? 0) ||
            ((score[ci] ?? 0) === (score[mi] ?? 0) && ci < mi)
          )
            m = c;
        }
        if (m === k) break;
        const t = heap[k] ?? 0;
        heap[k] = heap[m] ?? 0;
        heap[m] = t;
        k = m;
      }
    }
    return top;
  };
  cost[start] = 0;
  score[start] = h(start);
  push(start);
  while (heap.length > 0) {
    const i = pop();
    if (i === goal) break;
    if (closed[i] === 1) continue;
    closed[i] = 1;
    const cx = i % g.width;
    const cy = (i - cx) / g.width;
    for (const [dx, dy, step] of NEIGHBOURS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!free(g, nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (!free(g, cx + dx, cy) || !free(g, cx, cy + dy))) continue;
      const ni = ny * g.width + nx;
      const c = (cost[i] ?? 0) + step;
      if (c >= (cost[ni] ?? Number.POSITIVE_INFINITY)) continue;
      cost[ni] = c;
      from[ni] = i;
      score[ni] = c + h(ni);
      push(ni);
    }
  }
  if (start !== goal && from[goal] === -1) return null;
  const cells: number[] = [];
  for (let i = goal; i !== -1; i = i === start ? -1 : (from[i] ?? -1)) cells.push(i);
  cells.reverse();
  const points: { x: number; y: number }[] = [];
  const doors: { at: number; id: string }[] = [];
  let prevDir = -1;
  for (let k = 0; k < cells.length; k++) {
    const i = cells[k] ?? 0;
    const x = i % g.width;
    const y = (i - x) / g.width;
    const next = cells[k + 1];
    const door = g.doors[i];
    // Un point par changement de direction, et toujours sur une porte.
    const dir = next === undefined ? -2 : next - i;
    if (door !== undefined) doors.push({ at: points.length, id: door });
    if (k > 0 && (dir !== prevDir || door !== undefined)) points.push({ x: x + 0.5, y: y + 0.5 });
    prevDir = dir;
  }
  points.push({ x: tx, y: ty });
  return { points, doors };
}

/** Dijkstra sur le graphe des chemins, du nœud le plus proche du départ à celui de l'arrivée. */
function graphRoute(
  place: PlaceContent,
  fx: number,
  fy: number,
  tx: number,
  ty: number,
): Route | null {
  const paths = place.map.graph;
  if (paths === undefined) return null;
  const ids = Object.keys(paths.nodes).sort();
  if (ids.length === 0) return null;
  const nearest = (x: number, y: number): string => {
    let best = ids[0] ?? '';
    let bestD = Number.POSITIVE_INFINITY;
    for (const id of ids) {
      const p = paths.nodes[id];
      if (p === undefined) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    return best;
  };
  const from = nearest(fx, fy);
  const to = nearest(tx, ty);
  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, string>();
  const done = new Set<string>();
  for (;;) {
    let cur: string | null = null;
    let curD = Number.POSITIVE_INFINITY;
    for (const [id, d] of dist) if (!done.has(id) && d < curD) [cur, curD] = [id, d];
    if (cur === null || cur === to) break;
    done.add(cur);
    const p = paths.nodes[cur];
    if (p === undefined) continue;
    for (const edge of paths.edges) {
      const other = edge.a === cur ? edge.b : edge.b === cur ? edge.a : null;
      const q = other === null ? undefined : paths.nodes[other];
      if (other === null || q === undefined || done.has(other)) continue;
      const d = curD + Math.hypot(q.x - p.x, q.y - p.y);
      if (d < (dist.get(other) ?? Number.POSITIVE_INFINITY)) {
        dist.set(other, d);
        prev.set(other, cur);
      }
    }
  }
  if (!dist.has(to)) return null;
  const chain: string[] = [];
  for (let id: string | undefined = to; id !== undefined; id = prev.get(id)) chain.push(id);
  chain.reverse();
  const points = chain.flatMap((id) => {
    const p = paths.nodes[id];
    return p === undefined ? [] : [{ x: p.x, y: p.y }];
  });
  points.push({ x: tx, y: ty });
  return { points, doors: [] };
}

/** Trajet de (fx, fy) à (tx, ty) dans le lieu: graphe d'abord, grille à défaut; ligne droite en dernier recours. */
export function findRoute(
  content: Content,
  place: PlaceContent,
  state: ReadPlace,
  fx: number,
  fy: number,
  tx: number,
  ty: number,
): Route {
  return (
    graphRoute(place, fx, fy, tx, ty) ??
    gridRoute(gridOf(content, place, state), fx, fy, tx, ty) ?? {
      points: [{ x: tx, y: ty }],
      doors: [],
    }
  );
}
