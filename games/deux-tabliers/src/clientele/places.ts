/**
 * Places des clients et cheminement (technique 5.8): assises lues dans les meubles posés (type de
 * place selon `regles.json`), places debout au zinc, grille de 25 cm construite depuis la coque et
 * les meubles, A* borné. Les clients ne sont jamais des obstacles pour les joueurs (C15): rien ici
 * n'entre dans `simulation/collisions.ts`.
 */
import type { Content } from '../donnees/charger';
import type { Shape } from '../donnees/schemas';
import type { World } from '../etat/monde';
import { furnitureObstacles, shellObstacles } from '../simulation/collisions';
import { pushOut, type Vec2 } from '../simulation/geometrie';
import type { SimContext } from '../simulation/systemes';
import type { ClienteleContent, SeatKind } from './donnees';
import type { ClienteleState } from './etat';
import { extensionReady } from './economie';
import { approachCandidates, seatAnchor, type SeatAnchor } from '../etat/assises';

export interface Seat {
  readonly id: string;
  readonly kind: SeatKind;
  readonly x: number;
  readonly z: number;
  /** Cap du client assis (degrés, comme `yawDeg` des joueurs: 0 regarde le nord). */
  readonly yawDeg: number;
  readonly table: string | null;
}

function inShape(shape: Shape, x: number, z: number): boolean {
  if ('rect' in shape) {
    const [rx, rz, w, d] = shape.rect;
    return x >= rx && x <= rx + w && z >= rz && z <= rz + d;
  }
  const [cx, cz, r] = shape.circle;
  return Math.hypot(x - cx, z - cz) <= r;
}

interface Zone {
  readonly kind: string;
  readonly label: string;
  readonly shape: Shape;
}

function zonesOf(content: Content): Zone[] {
  const level = content.plan.levels[0] as unknown as { zones?: unknown } | undefined;
  const raw = level?.zones;
  if (!Array.isArray(raw)) return [];
  const out: Zone[] = [];
  for (const z of raw as { kind?: unknown; label?: unknown; shape?: unknown }[]) {
    if (
      typeof z.kind !== 'string' ||
      typeof z.label !== 'string' ||
      typeof z.shape !== 'object' ||
      z.shape === null
    )
      continue;
    const shape = z.shape as Shape;
    if (!('rect' in shape) && !('circle' in shape)) continue;
    out.push({ kind: z.kind, label: z.label, shape });
  }
  return out;
}

/** Point nommé du plan (`entrance`, `exits`, `wc`...) ou ligne de file. */
export function planPoint(content: Content, key: string): Vec2 | null {
  const level = content.plan.levels[0] as unknown as
    { points?: Record<string, unknown> } | undefined;
  const raw = level?.points?.[key];
  const first =
    Array.isArray(raw) && Array.isArray(raw[0])
      ? (raw[0] as unknown[])
      : (raw as unknown[] | undefined);
  if (!Array.isArray(first) || typeof first[0] !== 'number' || typeof first[1] !== 'number')
    return null;
  return { x: first[0], z: first[1] };
}

export interface QueueLine {
  readonly head: Vec2;
  readonly tail: Vec2;
  readonly register: Vec2;
  readonly pickup: Vec2;
}

export function queueLine(content: Content): QueueLine {
  const level = content.plan.levels[0] as unknown as { queues?: unknown } | undefined;
  const q = Array.isArray(level?.queues)
    ? (level.queues[0] as Record<string, unknown> | undefined)
    : undefined;
  const pt = (v: unknown, fx: number, fz: number): Vec2 =>
    Array.isArray(v) && typeof v[0] === 'number' && typeof v[1] === 'number'
      ? { x: v[0], z: v[1] }
      : { x: fx, z: fz };
  const points = Array.isArray(q?.points) ? (q.points as unknown[]) : [];
  // Les points de la file vont de la porte vers la caisse: la tête est le dernier.
  return {
    tail: pt(points[0], 10.5, 12),
    head: pt(points[points.length - 1], 10.5, 10),
    register: pt(q?.register, 10.5, 9.95),
    pickup: pt(q?.pickup, 8.35, 9.95),
  };
}

/**
 * Rang `row` de la file (0: devant la caisse), à `spacing` mètres l'un de l'autre, le long du mur
 * est comme au plan (de la caisse vers la porte), prolongé au-delà de la ligne si besoin.
 */
export function queueSpot(content: Content, row: number, spacing: number): Vec2 {
  const q = queueLine(content);
  const dx = q.tail.x - q.head.x;
  const dz = q.tail.z - q.head.z;
  const len = Math.hypot(dx, dz) || 1;
  return { x: q.head.x + (dx / len) * spacing * row, z: q.head.z + (dz / len) * spacing * row };
}

/**
 * Rangs qu'occupe un groupe debout: le premier devant, les autres deux par deux derrière lui
 * (même placement que le rendu, `memberPose`).
 */
export function groupRows(size: number): number {
  return 1 + Math.ceil(Math.max(0, size - 1) / 2);
}

function terraceZone(content: Content, cc: ClienteleContent): Zone | undefined {
  return zonesOf(content).find(
    (z) => z.kind === 'extension' && z.label.startsWith(cc.rules.walk.terraceZoneLabel),
  );
}

/** Assises de la salle et de la terrasse, d'après les meubles posés. */
export function seatList(
  sim: { content: Content; world: World },
  cc: ClienteleContent,
  s: ClienteleState,
): Seat[] {
  const { content, world } = sim;
  const terrace = terraceZone(content, cc);
  const tables = world.furniture.filter((f) => content.furniture.get(f.type)?.kind === 'table');
  const blocked = blockedZones(content, cc, s);
  const out: Seat[] = [];
  for (const f of world.furniture) {
    if (content.furniture.get(f.type)?.kind !== 'seat') continue;
    if (blocked.some((z) => inShape(z.shape, f.x, f.z))) continue;
    let kind: SeatKind = 'table';
    for (const [prefix, k] of Object.entries(cc.rules.seatKinds))
      if (f.type.startsWith(prefix)) kind = k;
    if (terrace !== undefined && inShape(terrace.shape, f.x, f.z)) kind = 'terrace';
    let table: string | null = null;
    let best = content.settings.seating.tableReach;
    for (const t of tables) {
      const d = Math.hypot(t.x - f.x, t.z - f.z);
      if (d < best) {
        best = d;
        table = t.id;
      }
    }
    // Assise déclarée du modèle et sens de la personne assise (`etat/assises.ts`).
    const a = seatAnchor(content, world.furniture, f);
    out.push({ id: f.id, kind, x: a.x, z: a.z, yawDeg: a.yawDeg, table });
  }
  return out;
}

function blockedZones(content: Content, cc: ClienteleContent, s: ClienteleState): Zone[] {
  const w = cc.rules.walk;
  return zonesOf(content).filter((z) => {
    if (!w.blockedZones.includes(z.kind)) return false;
    if (z.kind !== 'extension') return true;
    if (z.label.startsWith(w.terraceZoneLabel)) return false;
    for (const [label, ext] of Object.entries(cc.rules.extensionZones))
      if (z.label.startsWith(label) && extensionReady(s, ext)) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------------------------
// Grille et A*

export interface NavGrid {
  readonly key: string;
  readonly ox: number;
  readonly oz: number;
  readonly cell: number;
  readonly w: number;
  readonly h: number;
  readonly free: Uint8Array;
}

const gridCache = new WeakMap<Content, NavGrid>();

export function navGrid(sim: SimContext, cc: ClienteleContent, s: ClienteleState): NavGrid {
  const { content, world } = sim;
  const zones = blockedZones(content, cc, s);
  let key = `${String(zones.length)}:`;
  for (const f of world.furniture)
    key += `${f.id}${String(Math.round(f.x * 100))},${String(Math.round(f.z * 100))},${String(f.rotDeg)};`;
  const cached = gridCache.get(content);
  if (cached?.key === key) return cached;
  const level = content.plan.levels[0];
  const [fx, fz, fw, fd] = level?.frame ?? [0, 0, 16, 20];
  const cell = cc.rules.walk.cell;
  const w = Math.ceil(fw / cell);
  const h = Math.ceil(fd / cell);
  const free = new Uint8Array(w * h);
  const obstacles = [...shellObstacles(content), ...furnitureObstacles(content, world)];
  const p: Vec2 = { x: 0, z: 0 };
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = fx + (i + 0.5) * cell;
      const z = fz + (j + 0.5) * cell;
      if (zones.some((zn) => inShape(zn.shape, x, z))) continue;
      let ok = true;
      for (const o of obstacles) {
        p.x = x;
        p.z = z;
        if (pushOut(p, cc.rules.walk.radius, o)) {
          ok = false;
          break;
        }
      }
      if (ok) free[j * w + i] = 1;
    }
  }
  const grid: NavGrid = { key, ox: fx, oz: fz, cell, w, h, free };
  gridCache.set(content, grid);
  return grid;
}

/**
 * Point d'où l'on rejoint une assise et où l'on se relève: le premier point libre de la grille
 * devant, sur le côté ou derrière l'assise (jamais à travers sa table).
 */
export function seatApproach(g: NavGrid, a: SeatAnchor): Vec2 {
  for (const [x, z] of approachCandidates(a, 0.1)) {
    const [i, j] = cellOf(g, x, z);
    if (i >= 0 && j >= 0 && i < g.w && j < g.h && g.free[j * g.w + i] === 1) return { x, z };
  }
  const n = nearestFree(g, a.x, a.z);
  if (n === null) return { x: a.x, z: a.z };
  return { x: g.ox + ((n % g.w) + 0.5) * g.cell, z: g.oz + (Math.floor(n / g.w) + 0.5) * g.cell };
}

function cellOf(g: NavGrid, x: number, z: number): [number, number] {
  return [Math.floor((x - g.ox) / g.cell), Math.floor((z - g.oz) / g.cell)];
}

/** Case libre la plus proche d'un point (anneaux croissants), ou `null`. */
function nearestFree(g: NavGrid, x: number, z: number): number | null {
  const [ci, cj] = cellOf(g, x, z);
  for (let r = 0; r < 12; r++) {
    let best: number | null = null;
    let bestD = Infinity;
    for (let j = cj - r; j <= cj + r; j++) {
      for (let i = ci - r; i <= ci + r; i++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r) continue;
        if (i < 0 || j < 0 || i >= g.w || j >= g.h || g.free[j * g.w + i] !== 1) continue;
        const d = (i - ci) ** 2 + (j - cj) ** 2;
        if (d < bestD) {
          bestD = d;
          best = j * g.w + i;
        }
      }
    }
    if (best !== null) return best;
  }
  return null;
}

/**
 * Chemin de `from` à `to` (points du monde); le dernier point est `to` lui-même (une assise
 * se rejoint d'un pas depuis la case libre voisine). Sans chemin: la ligne droite.
 */
export function findPath(g: NavGrid, from: Vec2, to: Vec2, maxNodes: number): Vec2[] {
  const start = nearestFree(g, from.x, from.z);
  const goal = nearestFree(g, to.x, to.z);
  if (start === null || goal === null) return [{ x: to.x, z: to.z }];
  const gx = goal % g.w;
  const gz = Math.floor(goal / g.w);
  const cost = new Float32Array(g.w * g.h).fill(Infinity);
  const came = new Int32Array(g.w * g.h).fill(-1);
  const open: number[] = [start];
  const prio: number[] = [0];
  cost[start] = 0;
  let expanded = 0;
  const h = (n: number): number => {
    const dx = Math.abs((n % g.w) - gx);
    const dz = Math.abs(Math.floor(n / g.w) - gz);
    return Math.max(dx, dz) + 0.4142 * Math.min(dx, dz);
  };
  let found = false;
  while (open.length > 0 && expanded < maxNodes) {
    let bi = 0;
    for (let k = 1; k < prio.length; k++) if ((prio[k] ?? 0) < (prio[bi] ?? 0)) bi = k;
    const n = open[bi] ?? start;
    open.splice(bi, 1);
    prio.splice(bi, 1);
    if (n === goal) {
      found = true;
      break;
    }
    expanded++;
    const ni = n % g.w;
    const nj = Math.floor(n / g.w);
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (di === 0 && dj === 0) continue;
        const i = ni + di;
        const j = nj + dj;
        if (i < 0 || j < 0 || i >= g.w || j >= g.h) continue;
        const m = j * g.w + i;
        if (g.free[m] !== 1) continue;
        // Pas de coin coupé contre un mur.
        if (di !== 0 && dj !== 0 && (g.free[nj * g.w + i] !== 1 || g.free[j * g.w + ni] !== 1))
          continue;
        const c = (cost[n] ?? 0) + (di !== 0 && dj !== 0 ? 1.4142 : 1);
        if (c < (cost[m] ?? Infinity)) {
          cost[m] = c;
          came[m] = n;
          const at = open.indexOf(m);
          if (at >= 0) prio[at] = c + h(m);
          else {
            open.push(m);
            prio.push(c + h(m));
          }
        }
      }
    }
  }
  if (!found) return [{ x: to.x, z: to.z }];
  const cells: number[] = [];
  for (let n = goal; n !== -1 && n !== start; n = came[n] ?? -1) cells.push(n);
  cells.reverse();
  const out: Vec2[] = [];
  // Un point tous les deux pas suffit: la marche lisse entre eux.
  for (let k = 1; k < cells.length; k += 2) {
    const n = cells[k] ?? goal;
    out.push({
      x: g.ox + ((n % g.w) + 0.5) * g.cell,
      z: g.oz + (Math.floor(n / g.w) + 0.5) * g.cell,
    });
  }
  out.push({ x: to.x, z: to.z });
  return out;
}
