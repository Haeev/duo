/**
 * Pierres du gué (revue du tour 8, G9): une ligne de passage de grandes
 * pierres plates au pas, qui relie le bout du chemin d'une rive à celui de
 * l'autre (là où l'on traverse vraiment, et où la simulation fait passer les
 * personnages), puis des pierres plus petites dispersées sans grille (tirage
 * de Poisson), plus nombreuses à l'aval: le courant les y pousse.
 *
 * Calcul pur, sans Three.js: le terrain en tire les maillages, le courant
 * s'ouvre autour des pierres qui crèvent la surface.
 */
import type { GameMap } from '../etat/carte';
import { groundAt, mapMaxY, mapMinY } from '../etat/carte';
import { hash2 } from './bruit';
import { RENDER_SETTINGS } from './reglages';

const STONES = RENDER_SETTINGS.terrain.fordStones;

/** Une pierre du gué posée. */
export interface FordStone {
  x: number;
  y: number;
  /** Diamètre (m) le long de son grand axe, et rapport du petit axe au grand. */
  size: number;
  depth: number;
  /** Rotation autour de la verticale (rad). */
  rotation: number;
  /** Nombre de côtés (un modèle par nombre). */
  sides: number;
  /** `passage`: ligne de passage; `scatter`: dispersée, qui crève la surface; `flush`: à fleur d'eau. */
  kind: 'passage' | 'scatter' | 'flush';
}

interface Cell {
  cx: number;
  cy: number;
}

interface Point {
  x: number;
  y: number;
}

/** Groupes de cases du gué qui se touchent (un gué par groupe). */
function fordGroups(cells: readonly Cell[]): Cell[][] {
  const key = (c: Cell): string => `${c.cx}:${c.cy}`;
  const left = new Map(cells.map((c) => [key(c), c]));
  const groups: Cell[][] = [];
  for (const start of cells) {
    if (!left.has(key(start))) continue;
    left.delete(key(start));
    const group = [start];
    // Le parcours suit aussi les cases ajoutées en chemin (l'itérateur relit la longueur).
    for (const c of group) {
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const next = left.get(`${c.cx + dx}:${c.cy + dy}`);
        if (next !== undefined) {
          left.delete(key(next));
          group.push(next);
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

/**
 * Milieu (x) des cases de chemin les plus proches du gué en partant de la
 * rangée `cy` vers `dir` (au-delà de la berge), entre `x0` et `x1`: le bout du
 * chemin. Le milieu du gué s'il n'y en a pas.
 */
function pathEnd(map: GameMap, cy: number, dir: 1 | -1, x0: number, x1: number): number {
  for (let k = 0; k < PATH_SEARCH; k += 1) {
    const row = cy + dir * k;
    if (row < mapMinY(map) || row > mapMaxY(map)) break;
    const xs: number[] = [];
    for (let cx = x0; cx <= x1; cx += 1) {
      if (groundAt(map, cx, row) === 'path') xs.push(cx + 0.5);
    }
    if (xs.length > 0) return xs.reduce((a, b) => a + b, 0) / xs.length;
  }
  return (x0 + x1 + 1) / 2;
}

/** Rangées où chercher le bout du chemin, depuis le bord du gué (berge comprise). */
const PATH_SEARCH = 4;

/** Vrai si `c` est à moins de `tolerance` m de la droite (a, b). */
function nearLine(a: Point, b: Point, c: Point, tolerance: number): boolean {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  return (
    length > 1e-6 &&
    Math.abs((b.x - a.x) * (a.y - c.y) - (a.x - c.x) * (b.y - a.y)) / length < tolerance
  );
}

/** Vrai si `c` ferait avec trois pierres déjà posées un alignement de quatre (une grille se devine). */
function alignsFour(stones: readonly Point[], c: Point, tolerance: number): boolean {
  const all = [...stones, c];
  for (const [i, a] of all.entries()) {
    for (const b of all.slice(i + 1)) {
      if (all.filter((d) => d === a || d === b || nearLine(a, b, d, tolerance)).length >= 4)
        return true;
    }
  }
  return false;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Pierres de tous les gués de la carte. Le courant coule le long de x (la
 * rivière longe le bord sud): on traverse le long de y, du chemin nord au
 * chemin sud. `downstream`: signe du courant le long de x.
 */
export function layFordStones(
  map: GameMap,
  cells: readonly Cell[],
  downstream: number,
): FordStone[] {
  const out: FordStone[] = [];
  const pick = (seed: number, a: number, b: number, i: number, g: number): number =>
    lerp(a, b, hash2(i, g, seed));
  fordGroups(cells).forEach((group, g) => {
    const x0 = Math.min(...group.map((c) => c.cx));
    const x1 = Math.max(...group.map((c) => c.cx));
    const y0 = Math.min(...group.map((c) => c.cy));
    const y1 = Math.max(...group.map((c) => c.cy));
    const p = STONES.passage;
    // Ligne de passage: d'un bout de chemin à l'autre, centrée si le gué est plus long que les pas.
    const north = pathEnd(map, y0 - 1, -1, x0, x1);
    const south = pathEnd(map, y1 + 1, 1, x0, x1);
    const top = y0 + p.margin;
    const span = y1 + 1 - p.margin - top;
    const count = Math.max(p.count[0], Math.min(p.count[1], Math.round(span / p.pitch[1]) + 1));
    const pitch = Math.max(p.pitch[0], Math.min(p.pitch[1], span / (count - 1)));
    const start = top + (span - pitch * (count - 1)) / 2;
    const phase = hash2(g, 3, 211) * Math.PI * 2;
    const lineX = (y: number): number => {
      const t = (y - top) / Math.max(span, 1e-6);
      return lerp(north, south, t) + Math.sin(t * Math.PI * p.swayWaves + phase) * p.sway;
    };
    const placed: { x: number; y: number; r: number }[] = [];
    for (let i = 0; i < count; i += 1) {
      const y = start + i * pitch + (hash2(i, g, 221) - 0.5) * p.jitter;
      const x = lineX(y) + (hash2(i, g, 231) - 0.5) * p.jitter;
      const size = pick(241, p.size[0], p.size[1], i, g);
      const depth = pick(251, 0.82, 1, i, g);
      out.push({
        x,
        y,
        size,
        depth,
        rotation: hash2(i, g, 261) * Math.PI * 2,
        sides: STONES.sides[Math.floor(hash2(i, g, 271) * STONES.sides.length)] ?? 6,
        kind: 'passage',
      });
      placed.push({ x, y, r: (size * (1 + depth)) / 4 });
    }
    // Dispersion: tirage de Poisson (rayon minimal), plus de pierres à l'aval de la ligne.
    const s = STONES.scatter;
    const clear = s.keepClear
      .map((id) => map.points[id])
      .filter((pt): pt is Point => pt !== undefined);
    let laid = 0;
    for (let attempt = 0; attempt < s.attempts && laid < s.count; attempt += 1) {
      const x = pick(281, x0 + s.inset, x1 + 1 - s.inset, attempt, g);
      const y = pick(291, y0 + s.inset, y1 + 1 - s.inset, attempt, g);
      const side = Math.sign(x - lineX(y)) * downstream;
      if (hash2(attempt, g, 301) > (side > 0 ? s.downstreamOdds : s.upstreamOdds)) continue;
      const size = pick(311, s.size[0], s.size[1], attempt, g);
      const depth = pick(321, 0.7, 1, attempt, g);
      const r = (size * (1 + depth)) / 4;
      const crowded = placed.some(
        (o, k) => Math.hypot(o.x - x, o.y - y) < o.r + r + (k < count ? s.lineGap : s.gap),
      );
      if (crowded || clear.some((pt) => Math.hypot(pt.x - x, pt.y - y) < s.clearRadius + r))
        continue;
      if (alignsFour(placed.slice(count), { x, y }, s.alignTolerance)) continue;
      placed.push({ x, y, r });
      out.push({
        x,
        y,
        size,
        depth,
        rotation: hash2(attempt, g, 331) * Math.PI * 2,
        sides: STONES.sides[Math.floor(hash2(attempt, g, 341) * STONES.sides.length)] ?? 6,
        // Tiré sur la position: les tirages par numéro d'essai se suivent trop (ceux qui passent le filtre de l'aval).
        kind: hash2(x * 17.3, y * 11.1, 351) < s.flushShare ? 'flush' : 'scatter',
      });
      laid += 1;
    }
  });
  return out;
}
