/**
 * Règles de pose (technique 5.8): fonction pure partagée par l'aperçu (fantôme), l'hôte et les
 * tests. Une pose est refusée avec une phrase claire, jamais par la couleur seule (ux 6.3):
 * hors de la pièce, chevauchement, zone à laisser libre (file, porte, passe), passage de moins de
 * 0,9 m jusqu'à une place ou de 1,2 m dans l'allée (C13), prise ou point d'eau trop loin (DE-04),
 * assise dos à sa table (règle du client), mur occupé, limite de 60 objets (C6).
 */
import type { Content } from '../donnees/charger';
import type { FurnitureType, PlanElement } from '../donnees/schemas';
import type { PlacedFurniture, World } from '../etat/monde';
import { box, localToWorld, type Obstacle } from '../simulation/geometrie';
import { shellObstacles } from '../simulation/collisions';
import { orientSeat } from './assises';
import type { CatalogItem, Placement } from './donnees';
import { CARTON_HEAVY, CARTON_SMALL } from './donnees';
import { currentPlan, roomOpen } from './extensions';
import type { PlacementRequest } from './intentions';

export type Verdict =
  | {
      readonly ok: true;
      /** Orientation retenue (une assise se tourne vers sa table). */
      readonly rotDeg: number;
      /** Assises voisines à retourner vers la table qu'on pose. */
      readonly reorient: readonly { id: string; rotDeg: number }[];
    }
  | { readonly ok: false; readonly reason: string; readonly detail: string };

export type Mount =
  'floor' | 'wall' | 'ceiling' | 'surface' | 'sill' | 'store' | 'facade' | 'vitrine';

const EPS = 1e-6;

export function itemOf(content: Content, type: string): CatalogItem | undefined {
  return content.arrangement.items.get(type);
}

export function placementOf(content: Content, type: string): Placement {
  return itemOf(content, type)?.placement ?? 'floor';
}

const MOUNTS: Readonly<Record<Placement, Mount>> = {
  floor: 'floor',
  floor_terrace: 'floor',
  floor_wall: 'floor',
  floor_under: 'floor',
  terrace: 'floor',
  street: 'floor',
  wall_cover: 'floor',
  floor_cover: 'floor',
  wall: 'wall',
  ceiling: 'ceiling',
  surface: 'surface',
  counter: 'surface',
  counter_tip: 'surface',
  window_sill: 'sill',
  terrace_store: 'store',
  facade: 'facade',
  vitrine: 'vitrine',
};

export function mountOf(placement: Placement): Mount {
  return MOUNTS[placement];
}

/** Les meubles qui comptent dans la limite de 60 (C6): ni postes fixes, ni cartons. */
export function countsInLimit(type: FurnitureType | undefined): boolean {
  return type !== undefined && !type.fixed && type.id !== CARTON_SMALL && type.id !== CARTON_HEAVY;
}

// ---------------------------------------------------------------------------------------------
// Géométrie plane

function corners(o: Extract<Obstacle, { kind: 'box' }>): [number, number][] {
  const out: [number, number][] = [];
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const) {
    const p = localToWorld(o.x, o.z, (o.rotRad * 180) / Math.PI, sx * o.hx, sz * o.hz);
    out.push([p.x, p.z]);
  }
  return out;
}

/** Distance d'un point à un obstacle (0 dedans). */
export function distanceTo(px: number, pz: number, o: Obstacle): number {
  if (o.kind === 'disc') return Math.max(0, Math.hypot(px - o.x, pz - o.z) - o.r);
  const cos = Math.cos(o.rotRad);
  const sin = Math.sin(o.rotRad);
  const wx = px - o.x;
  const wz = pz - o.z;
  const lx = wx * cos - wz * sin;
  const lz = wx * sin + wz * cos;
  const dx = Math.max(0, Math.abs(lx) - o.hx);
  const dz = Math.max(0, Math.abs(lz) - o.hz);
  return Math.hypot(dx, dz);
}

function axes(o: Extract<Obstacle, { kind: 'box' }>): [number, number][] {
  // Axes locaux x et z du rectangle dans le monde (même convention que `localToWorld`).
  const c = Math.cos(o.rotRad);
  const s = Math.sin(o.rotRad);
  return [
    [c, -s],
    [s, c],
  ];
}

/** Deux obstacles se chevauchent (au-delà d'une marge `margin`, négative pour tolérer un contact). */
export function overlaps(a: Obstacle, b: Obstacle, margin = -0.005): boolean {
  if (a.kind === 'disc' && b.kind === 'disc')
    return Math.hypot(a.x - b.x, a.z - b.z) < a.r + b.r + margin;
  if (a.kind === 'disc') return distanceTo(a.x, a.z, b) < a.r + margin;
  if (b.kind === 'disc') return distanceTo(b.x, b.z, a) < b.r + margin;
  const ca = corners(a);
  const cb = corners(b);
  for (const [ax, az] of [...axes(a), ...axes(b)]) {
    let minA = Infinity;
    let maxA = -Infinity;
    let minB = Infinity;
    let maxB = -Infinity;
    for (const [x, z] of ca) {
      const p = x * ax + z * az;
      minA = Math.min(minA, p);
      maxA = Math.max(maxA, p);
    }
    for (const [x, z] of cb) {
      const p = x * ax + z * az;
      minB = Math.min(minB, p);
      maxB = Math.max(maxB, p);
    }
    if (maxA + margin <= minB || maxB + margin <= minA) return false;
  }
  return true;
}

export function footprintOf(
  type: FurnitureType,
  x: number,
  z: number,
  rotDeg: number,
): Extract<Obstacle, { kind: 'box' }> {
  return box(x, z, type.footprint[0], type.footprint[1], rotDeg) as Extract<
    Obstacle,
    { kind: 'box' }
  >;
}

type Rect = readonly [number, number, number, number];

function inRect(x: number, z: number, r: Rect, tol = 0.001): boolean {
  return x >= r[0] - tol && x <= r[0] + r[2] + tol && z >= r[1] - tol && z <= r[1] + r[3] + tol;
}

function rectBox(r: Rect): Extract<Obstacle, { kind: 'box' }> {
  return box(r[0] + r[2] / 2, r[1] + r[3] / 2, r[2], r[3], 0) as Extract<Obstacle, { kind: 'box' }>;
}

// ---------------------------------------------------------------------------------------------
// Faces de mur

/** Un pan de mur où accrocher un cadre: segment sur une ligne, avant tourné vers la pièce. */
export interface WallFace {
  readonly room: string;
  /** `z`: mur selon x (ligne z = `line`); `x`: mur selon z (ligne x = `line`). */
  readonly axis: 'x' | 'z';
  readonly line: number;
  readonly from: number;
  readonly to: number;
  /** Cap de l'avant d'un objet accroché (0 = +z, 90 = +x, 180 = -z, 270 = -x). */
  readonly rotDeg: number;
  /** Signe de la normale vers la pièce, selon l'axe perpendiculaire. */
  readonly normal: 1 | -1;
  readonly outside: boolean;
}

const faceCache = new WeakMap<object, readonly WallFace[]>();

function wallLike(el: PlanElement): boolean {
  return (
    (el.kind === 'wall' || el.kind === 'partition') && (el.height ?? 2.7) >= 2 && 'rect' in el.shape
  );
}

/** Pans de mur intérieurs des pièces ouvertes, et la façade sud de la salle (enseignes). */
export function wallFaces(content: Content, world: World): readonly WallFace[] {
  const plan = currentPlan(content, world);
  const key = plan;
  const cached = faceCache.get(key);
  if (cached !== undefined) return filterOpen(content, world, cached);
  const elements = plan.levels[0]?.elements ?? [];
  const faces: WallFace[] = [];
  const near = (a: number, b: number): boolean => Math.abs(a - b) < 0.06;
  for (const room of content.arrangement.rooms) {
    if (room.outdoor) continue;
    const [rx, rz, rw, rd] = room.space;
    const sides = [
      { axis: 'z' as const, line: rz, lo: rx, hi: rx + rw, rotDeg: 0, normal: 1 as const },
      { axis: 'z' as const, line: rz + rd, lo: rx, hi: rx + rw, rotDeg: 180, normal: -1 as const },
      { axis: 'x' as const, line: rx, lo: rz, hi: rz + rd, rotDeg: 90, normal: 1 as const },
      { axis: 'x' as const, line: rx + rw, lo: rz, hi: rz + rd, rotDeg: 270, normal: -1 as const },
    ];
    for (const side of sides) {
      for (const el of elements) {
        if (!wallLike(el) || !('rect' in el.shape)) continue;
        const [x, z, w, d] = el.shape.rect;
        // Le mur borde la pièce de l'extérieur de ce côté.
        const touches =
          side.axis === 'z'
            ? side.normal === 1
              ? near(z + d, side.line)
              : near(z, side.line)
            : side.normal === 1
              ? near(x + w, side.line)
              : near(x, side.line);
        if (!touches) continue;
        const a = side.axis === 'z' ? x : z;
        const b = side.axis === 'z' ? x + w : z + d;
        const from = Math.max(a, side.lo);
        const to = Math.min(b, side.hi);
        if (to - from < 0.2) continue;
        faces.push({
          room: room.id,
          axis: side.axis,
          line: side.line,
          from,
          to,
          rotDeg: side.rotDeg,
          normal: side.normal,
          outside: false,
        });
      }
    }
  }
  // Façade sud de la salle (au-dessus de la vitrine): enseignes.
  const salle = content.arrangement.rooms.find((r) => r.extension === null && !r.outdoor);
  if (salle !== undefined) {
    const [rx, rz, rw, rd] = salle.space;
    const front = elements.find(
      (el) => el.kind === 'wall' && 'rect' in el.shape && near(el.shape.rect[1], rz + rd),
    );
    const depth = front !== undefined && 'rect' in front.shape ? front.shape.rect[3] : 0.5;
    faces.push({
      room: salle.id,
      axis: 'z',
      line: rz + rd + depth,
      from: rx,
      to: rx + rw,
      rotDeg: 0,
      normal: 1,
      outside: true,
    });
  }
  faceCache.set(key, faces);
  return filterOpen(content, world, faces);
}

function filterOpen(
  content: Content,
  world: World,
  faces: readonly WallFace[],
): readonly WallFace[] {
  return faces.filter((f) => {
    const room = content.arrangement.rooms.find((r) => r.id === f.room);
    return room !== undefined && roomOpen(world, room.extension);
  });
}

/** Centre d'un objet accroché à `face` à l'abscisse `along` (épaisseur `depth`). */
export function onFace(face: WallFace, along: number, depth: number): { x: number; z: number } {
  const off = face.line + face.normal * (depth / 2);
  return face.axis === 'z' ? { x: along, z: off } : { x: off, z: along };
}

function faceOf(
  content: Content,
  world: World,
  x: number,
  z: number,
  depth: number,
  rotDeg: number,
  outside: boolean,
): WallFace | null {
  for (const f of wallFaces(content, world)) {
    if (f.outside !== outside) continue;
    if (Math.abs(norm(rotDeg) - f.rotDeg) > 1) continue;
    const off = f.line + f.normal * (depth / 2);
    const along = f.axis === 'z' ? x : z;
    const across = f.axis === 'z' ? z : x;
    if (Math.abs(across - off) < 0.03 && along >= f.from - EPS && along <= f.to + EPS) return f;
  }
  return null;
}

export function norm(deg: number): number {
  return ((Math.round(deg) % 360) + 360) % 360;
}

// ---------------------------------------------------------------------------------------------
// Passages (C13): grille de 25 cm, distance de chaque case au plus proche obstacle.

interface Grid {
  readonly x0: number;
  readonly z0: number;
  readonly nx: number;
  readonly nz: number;
  readonly g: number;
}

function gridFor(content: Content): Grid {
  const g = content.arrangement.rules.grid;
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (const r of content.arrangement.rooms) {
    minX = Math.min(minX, r.space[0]);
    minZ = Math.min(minZ, r.space[1]);
    maxX = Math.max(maxX, r.space[0] + r.space[2]);
    maxZ = Math.max(maxZ, r.space[1] + r.space[3]);
  }
  const [ex, ez] = content.arrangement.entrance;
  maxZ = Math.max(maxZ, ez + g);
  minX = Math.min(minX, ex);
  maxX = Math.max(maxX, ex);
  return {
    x0: minX,
    z0: minZ,
    nx: Math.ceil((maxX - minX) / g),
    nz: Math.ceil((maxZ - minZ) / g),
    g,
  };
}

export interface PassageProblem {
  readonly reason: string;
  readonly detail: string;
}

/**
 * Vérifie les passages des clients avec les meubles `furniture`: depuis l'entrée, un passage de
 * `clearanceToSeat` jusqu'à chaque place (le dernier pas, `seatReach`, peut se faufiler à
 * `minPassage`), et l'allée de `mainAisle` jusqu'au comptoir. `focus`: le meuble qu'on pose, pour
 * mesurer l'étroiture qu'il crée.
 */
export function passageProblem(
  content: Content,
  world: World,
  furniture: readonly PlacedFurniture[],
  focus: Obstacle | null,
): PassageProblem | null {
  const rules = content.arrangement.rules;
  const grid = gridFor(content);
  const shell = shellObstacles(content, world);
  const obstacles: Obstacle[] = [...shell];
  const seats: { o: Obstacle; label: string }[] = [];
  for (const f of furniture) {
    const type = content.furniture.get(f.type);
    if (type?.blocks !== true || f.y > 0.05) continue;
    const o = footprintOf(type, f.x, f.z, f.rotDeg);
    obstacles.push(o);
    if (type.kind === 'seat' && seatInOpenRoom(content, world, f))
      seats.push({ o, label: type.label });
  }
  // Zones réservées au personnel: les clients n'y passent pas.
  const staffOnly = content.arrangement.staffZones;

  const fast = packObstacles(obstacles);
  const { nx, nz, g, x0, z0 } = grid;
  const clear = new Float32Array(nx * nz);
  const cx = (i: number): number => x0 + (i + 0.5) * g;
  const cz = (j: number): number => z0 + (j + 0.5) * g;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = cx(i);
      const z = cz(j);
      // Zones du personnel: aucun client n'y passe.
      const staff = staffOnly.some((r) => inRect(x, z, r, -0.001));
      clear[j * nx + i] = staff ? 0 : fastDistance(fast, x, z);
    }
  }
  // Tolérance d'une demi-case: une case mesure un passage à 12,5 cm près (rastérisation).
  const tol = g / 2;
  const reach = (threshold: number): Uint8Array => {
    const seen = new Uint8Array(nx * nz);
    const [ex, ez] = content.arrangement.entrance;
    const si = Math.floor((ex - x0) / g);
    const sj = Math.min(nz - 1, Math.floor((ez - z0) / g));
    const queue: number[] = [];
    // L'entrée: les cases de la rangée de la porte qui laissent passer.
    for (let di = -3; di <= 3; di++) {
      const i = si + di;
      if (i < 0 || i >= nx) continue;
      const k = sj * nx + i;
      if ((clear[k] ?? 0) + tol >= threshold) {
        seen[k] = 1;
        queue.push(k);
      }
    }
    while (queue.length > 0) {
      const k = queue.pop() ?? 0;
      const i = k % nx;
      const j = (k - i) / nx;
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const a = i + di;
        const b = j + dj;
        if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
        const n = b * nx + a;
        if (seen[n] === 1 || (clear[n] ?? 0) + tol < threshold) continue;
        seen[n] = 1;
        queue.push(n);
      }
    }
    return seen;
  };
  const near = (seen: Uint8Array, test: (x: number, z: number) => boolean): boolean => {
    for (let k = 0; k < seen.length; k++) {
      if (seen[k] !== 1) continue;
      const i = k % nx;
      if (test(cx(i), cz((k - i) / nx))) return true;
    }
    return false;
  };
  const width = (): number => narrowest(focus, obstacles, clear, grid);

  const aisle = reach(rules.mainAisle / 2);
  for (const [tx, tz] of content.arrangement.aisleTargets) {
    if (!near(aisle, (x, z) => Math.hypot(x - tx, z - tz) <= 0.75)) {
      return {
        reason: `Ça ne passe pas : passage de ${cm(width())}`,
        detail: `Il faut ${cm(rules.mainAisle)} dans l'allée, de la porte jusqu'au comptoir.`,
      };
    }
  }
  const wide = reach(rules.clearanceToSeat / 2);
  const narrow = reach(rules.minPassage / 2);
  for (const seat of seats) {
    const ok =
      near(wide, (x, z) => distanceTo(x, z, seat.o) <= rules.seatReach + tol) &&
      near(narrow, (x, z) => distanceTo(x, z, seat.o) <= rules.minPassage / 2 + tol);
    if (!ok) {
      return {
        reason: `Ça ne passe pas : passage de ${cm(width())}`,
        detail: `Il faut ${cm(rules.clearanceToSeat)} pour que les clients rejoignent leur place (${seat.label.toLowerCase()}).`,
      };
    }
  }
  return null;
}

/** Obstacles en tableau plat (cosinus et sinus calculés une fois): la grille en fait 100 000 tests. */
function packObstacles(obstacles: readonly Obstacle[]): Float64Array {
  const out = new Float64Array(obstacles.length * 6);
  obstacles.forEach((o, k) => {
    const b = k * 6;
    if (o.kind === 'disc') {
      out.set([o.x, o.z, o.r, -1, 0, 0], b);
    } else out.set([o.x, o.z, o.hx, o.hz, Math.cos(o.rotRad), Math.sin(o.rotRad)], b);
  });
  return out;
}

function fastDistance(p: Float64Array, x: number, z: number): number {
  let best = Infinity;
  for (let b = 0; b < p.length; b += 6) {
    const ox = p[b] ?? 0;
    const oz = p[b + 1] ?? 0;
    const hx = p[b + 2] ?? 0;
    const hz = p[b + 3] ?? 0;
    let d: number;
    if (hz < 0) d = Math.max(0, Math.hypot(x - ox, z - oz) - hx);
    else {
      const c = p[b + 4] ?? 1;
      const s = p[b + 5] ?? 0;
      const wx = x - ox;
      const wz = z - oz;
      const dx = Math.max(0, Math.abs(wx * c - wz * s) - hx);
      const dz = Math.max(0, Math.abs(wx * s + wz * c) - hz);
      d = dx === 0 ? dz : dz === 0 ? dx : Math.sqrt(dx * dx + dz * dz);
    }
    if (d < best) best = d;
  }
  return best;
}

function cm(m: number): string {
  return `${Math.max(0, Math.round((m * 100) / 5) * 5)} cm`;
}

/** Étroiture créée par le meuble posé: la plus petite somme de ses distances aux autres obstacles. */
function narrowest(
  focus: Obstacle | null,
  obstacles: readonly Obstacle[],
  _clear: Float32Array,
  grid: Grid,
): number {
  if (focus === null) return 0;
  let best = Infinity;
  const { nx, nz, g, x0, z0 } = grid;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = x0 + (i + 0.5) * g;
      const z = z0 + (j + 0.5) * g;
      const df = distanceTo(x, z, focus);
      if (df <= 0 || df > 0.9) continue;
      let dother = Infinity;
      for (const o of obstacles) if (o !== focus) dother = Math.min(dother, distanceTo(x, z, o));
      if (dother <= 0 || dother > 0.9) continue;
      best = Math.min(best, df + dother);
    }
  }
  return best === Infinity ? 0 : best;
}

function seatInOpenRoom(content: Content, world: World, f: PlacedFurniture): boolean {
  return content.arrangement.rooms.some(
    (r) => roomOpen(world, r.extension) && inRect(f.x, f.z, r.space),
  );
}

// ---------------------------------------------------------------------------------------------
// La pose

export interface Candidate extends PlacementRequest {
  readonly type: string;
}

const refuse = (reason: string, detail = ''): Verdict => ({ ok: false, reason, detail });

/** Meubles posés une fois la pose faite (pour les règles qui regardent l'ensemble). */
function withCandidate(
  world: World,
  cand: Candidate,
  ignore: ReadonlySet<string>,
  id: string,
  rotDeg: number,
): PlacedFurniture[] {
  const out = world.furniture.filter((f) => !ignore.has(f.id)).map((f) => ({ ...f }));
  out.push({ id, type: cand.type, x: cand.x, z: cand.z, y: cand.y, rotDeg });
  return out;
}

/**
 * Vérifie la pose de `cand` (les meubles `ignore` ne comptent pas: la pièce tenue elle-même, ou
 * la charge portée). `id`: identifiant du meuble une fois posé.
 */
export function checkPlacement(
  content: Content,
  world: World,
  cand: Candidate,
  ignore: ReadonlySet<string>,
  id = '__candidat__',
): Verdict {
  const type = content.furniture.get(cand.type);
  if (type === undefined) return refuse('Ça ne se pose pas ici.');
  const rules = content.arrangement.rules;
  const placement = placementOf(content, cand.type);
  const mount = mountOf(placement);
  const count = world.furniture.filter(
    (f) => !ignore.has(f.id) && countsInLimit(content.furniture.get(f.type)),
  ).length;
  if (countsInLimit(type) && count >= rules.objectLimit)
    return refuse(
      `Le café est plein : ${rules.objectLimit} objets au plus.`,
      'Range un objet dans la réserve pour faire de la place.',
    );
  const need = content.arrangement.needs[cand.type];
  if (need !== undefined) {
    const points = need === 'water' ? content.arrangement.waterPoints : content.arrangement.outlets;
    const limit = need === 'water' ? rules.waterReach : rules.outletReach;
    if (!points.some(([px, pz]) => Math.hypot(px - cand.x, pz - cand.z) <= limit))
      return need === 'water'
        ? refuse(
            "Ça ne passe pas : trop loin de l'eau",
            `Il faut un point d'eau à moins de ${cm(limit)} (entouré au sol).`,
          )
        : refuse(
            'Ça ne passe pas : trop loin d’une prise',
            `Il faut une prise à moins de ${cm(limit)} (entourée au sol).`,
          );
  }
  switch (mount) {
    case 'floor':
      return checkFloor(content, world, cand, type, placement, ignore, id);
    case 'wall':
    case 'facade':
      return checkWall(content, world, cand, type, ignore, mount === 'facade');
    case 'ceiling':
      return checkHanging(content, world, cand, type, ignore, 'ceiling');
    case 'store':
      return checkHanging(content, world, cand, type, ignore, 'store');
    case 'surface':
      return checkSurface(content, world, cand, type, placement, ignore);
    case 'sill':
    case 'vitrine':
      return checkWindow(content, world, cand, type, ignore, mount);
  }
}

function roomsFor(
  content: Content,
  world: World,
  placement: Placement,
): { rect: Rect; label: string }[] {
  const out: { rect: Rect; label: string }[] = [];
  for (const room of content.arrangement.rooms) {
    if (!roomOpen(world, room.extension)) continue;
    const terraceOnly = placement === 'terrace';
    const indoorOnly =
      placement === 'floor' || placement === 'floor_wall' || placement === 'floor_under';
    if (terraceOnly && !room.outdoor) continue;
    if (indoorOnly && room.outdoor) continue;
    for (const r of room.free) out.push({ rect: r, label: room.label });
  }
  return out;
}

function checkFloor(
  content: Content,
  world: World,
  cand: Candidate,
  type: FurnitureType,
  placement: Placement,
  ignore: ReadonlySet<string>,
  id: string,
): Verdict {
  if (cand.y > 0.01) return refuse('Ce meuble se pose au sol.');
  const rotDeg0 = norm(cand.rotDeg);
  // Une assise se tourne d'elle-même vers sa table (règle du client, 2026-11-07).
  const others = world.furniture.filter((f) => !ignore.has(f.id));
  const rotDeg =
    type.kind === 'seat'
      ? orientSeat(
          { id, type: cand.type, x: cand.x, z: cand.z, rotDeg: rotDeg0 },
          others,
          content.furniture,
          content.settings.seating.tableReach,
        )
      : rotDeg0;
  const fp = footprintOf(type, cand.x, cand.z, rotDeg);
  const areas = roomsFor(content, world, placement);
  const inside = corners(fp).every(([x, z]) => areas.some((a) => inRect(x, z, a.rect)));
  if (!inside) {
    const terrace = content.arrangement.rooms.find((r) => r.outdoor);
    if (terrace !== undefined && inRect(cand.x, cand.z, terrace.space)) {
      if (!roomOpen(world, terrace.extension))
        return refuse(
          "La terrasse n'est pas encore ouverte.",
          'Elle s’achète sur la tablette, au palier « Deux tasses ».',
        );
      if (placement === 'floor' || placement === 'floor_wall' || placement === 'floor_under')
        return refuse(
          'Ce meuble reste à l’intérieur.',
          'Dehors, seuls les meubles de jardin et de terrasse tiennent.',
        );
    }
    if (placement === 'terrace')
      return refuse('Ça se pose sur la terrasse.', 'Sous le store, devant la vitrine.');
    return refuse(
      'Ça ne se pose pas ici : hors de la salle.',
      'Les meubles se posent dans la salle, ou dans les pièces ouvertes.',
    );
  }
  const rug = placement === 'floor_under';
  if (!rug) {
    for (const o of shellObstacles(content, world))
      if (overlaps(fp, o)) return refuse('Ça ne passe pas : un mur est dans le chemin.');
  }
  for (const f of world.furniture) {
    if (ignore.has(f.id) || f.y > 0.05) continue;
    const t = content.furniture.get(f.type);
    if (t === undefined) continue;
    const otherRug = placementOf(content, f.type) === 'floor_under';
    if (rug !== otherRug) continue;
    if (!rug && !t.blocks) continue;
    if (overlaps(fp, footprintOf(t, f.x, f.z, f.rotDeg)))
      return refuse(`Ça ne passe pas : ${t.label.toLowerCase()} est déjà là.`);
  }
  if (placement === 'floor_wall') {
    // Dos au mur: le milieu de l'arrière touche un mur (à 5 cm près).
    const back = localToWorld(cand.x, cand.z, rotDeg, 0, -(type.footprint[1] / 2 + 0.05));
    const touching = shellObstacles(content, world).some(
      (o) => distanceTo(back.x, back.z, o) <= 0.001,
    );
    if (!touching)
      return refuse(
        'Ce meuble se pose dos au mur.',
        'Approche-le d’un mur libre: il s’y colle de lui-même.',
      );
  }
  if (rug || !type.blocks) return { ok: true, rotDeg, reorient: [] };
  for (const k of content.arrangement.keepClear)
    if (overlaps(fp, rectBox(k.rect))) return refuse(k.reason);
  // Une table posée: les assises voisines se tournent vers elle si c'est désormais leur table.
  const reorient: { id: string; rotDeg: number }[] = [];
  const after = withCandidate(world, cand, ignore, id, rotDeg);
  if (type.kind === 'table') {
    for (const f of after) {
      const t = content.furniture.get(f.type);
      if (t?.kind !== 'seat' || f.id === id) continue;
      const r = orientSeat(f, after, content.furniture, content.settings.seating.tableReach);
      if (norm(r) === norm(f.rotDeg)) continue;
      const turned = footprintOf(t, f.x, f.z, r);
      const blocked = after.some((g) => {
        if (g.id === f.id) return false;
        const gt = content.furniture.get(g.type);
        return (
          gt?.blocks === true && g.y < 0.05 && overlaps(turned, footprintOf(gt, g.x, g.z, g.rotDeg))
        );
      });
      if (blocked)
        return refuse(
          'Une assise voisine ne pourrait plus se tourner vers sa table.',
          `${t.label}: fais-lui de la place.`,
        );
      reorient.push({ id: f.id, rotDeg: r });
      f.rotDeg = r;
    }
  }
  const problem = passageProblem(content, world, after, fp);
  if (problem !== null) return refuse(problem.reason, problem.detail);
  return { ok: true, rotDeg, reorient };
}

function piecesOn(
  world: World,
  ignore: ReadonlySet<string>,
  test: (f: PlacedFurniture) => boolean,
): PlacedFurniture[] {
  return world.furniture.filter((f) => !ignore.has(f.id) && test(f));
}

function checkWall(
  content: Content,
  world: World,
  cand: Candidate,
  type: FurnitureType,
  ignore: ReadonlySet<string>,
  outside: boolean,
): Verdict {
  const depth = type.footprint[1];
  const face = faceOf(content, world, cand.x, cand.z, depth, cand.rotDeg, outside);
  if (face === null)
    return outside
      ? refuse('Une enseigne se pose sur la façade.', 'Au-dessus de la vitrine, côté place.')
      : refuse('Ça se pose sur un mur libre.', 'Ni fenêtre, ni porte, ni vitrine.');
  const half = type.footprint[0] / 2;
  const along = face.axis === 'z' ? cand.x : cand.z;
  if (along - half < face.from - EPS || along + half > face.to + EPS)
    return refuse('Ça dépasse du mur.', 'Il faut un pan de mur assez large.');
  const rules = content.arrangement.rules;
  if (
    !outside &&
    (cand.y < rules.wallItemMinY - EPS || cand.y + type.height > rules.wallItemMaxY + EPS)
  )
    return refuse('Trop haut ou trop bas sur le mur.');
  const fp = footprintOf(type, cand.x, cand.z, face.rotDeg);
  for (const f of piecesOn(
    world,
    ignore,
    (f) => mountOf(placementOf(content, f.type)) === (outside ? 'facade' : 'wall'),
  )) {
    const t = content.furniture.get(f.type);
    if (t === undefined) continue;
    const vertical = cand.y < f.y + t.height && f.y < cand.y + type.height;
    if (vertical && overlaps(fp, footprintOf(t, f.x, f.z, f.rotDeg)))
      return refuse(`Ce bout de mur est pris : ${t.label.toLowerCase()}.`);
  }
  if (!outside) {
    const grown = { ...fp, hz: fp.hz + 0.05 };
    for (const f of world.furniture) {
      if (ignore.has(f.id)) continue;
      const t = content.furniture.get(f.type);
      if (t?.blocks !== true) continue;
      if (f.y + t.height > cand.y && overlaps(grown, footprintOf(t, f.x, f.z, f.rotDeg)))
        return refuse(`Ça ne passe pas : ${t.label.toLowerCase()} cache ce bout de mur.`);
    }
  }
  return { ok: true, rotDeg: face.rotDeg, reorient: [] };
}

function checkHanging(
  content: Content,
  world: World,
  cand: Candidate,
  type: FurnitureType,
  ignore: ReadonlySet<string>,
  where: 'ceiling' | 'store',
): Verdict {
  const rules = content.arrangement.rules;
  const top = where === 'ceiling' ? rules.ceiling : rules.storeHeight;
  if (Math.abs(cand.y + type.height - top) > 0.02)
    return refuse(
      where === 'ceiling' ? 'Ça se suspend au plafond.' : 'Ça se suspend sous le store.',
    );
  const fp = footprintOf(type, cand.x, cand.z, cand.rotDeg);
  const rooms = content.arrangement.rooms.filter((r) =>
    where === 'store' ? r.outdoor : !r.outdoor,
  );
  const room = rooms.find((r) => corners(fp).every(([x, z]) => inRect(x, z, r.space)));
  if (room === undefined)
    return refuse(
      where === 'ceiling'
        ? 'Ça se suspend au plafond d’une pièce.'
        : 'Ça se suspend sous le store de la terrasse.',
    );
  if (!roomOpen(world, room.extension))
    return refuse(
      where === 'store'
        ? "La terrasse n'est pas encore ouverte."
        : 'Cette pièce n’est pas encore ouverte.',
    );
  const mount = where === 'ceiling' ? 'ceiling' : 'store';
  for (const f of piecesOn(world, ignore, (f) => mountOf(placementOf(content, f.type)) === mount)) {
    const t = content.furniture.get(f.type);
    if (t !== undefined && overlaps(fp, footprintOf(t, f.x, f.z, f.rotDeg)))
      return refuse(`La place est prise : ${t.label.toLowerCase()}.`);
  }
  // Rien ne traverse: une suspension ne descend pas dans un meuble haut.
  for (const f of world.furniture) {
    if (ignore.has(f.id)) continue;
    const t = content.furniture.get(f.type);
    if (t === undefined || mountOf(placementOf(content, f.type)) === mount) continue;
    if (f.y + t.height > cand.y && overlaps(fp, footprintOf(t, f.x, f.z, f.rotDeg)))
      return refuse(`Ça touche ${t.label.toLowerCase()} : trop bas au-dessus.`);
  }
  return { ok: true, rotDeg: norm(cand.rotDeg), reorient: [] };
}

/** Surfaces d'un meuble posé (dans le monde): dessus de table, étagère, comptoir. */
export function surfacesOf(
  content: Content,
  f: PlacedFurniture,
): { rect: Extract<Obstacle, { kind: 'box' }>; y: number; placement: 'surface' | 'counter' }[] {
  const list = content.arrangement.surfaces[f.type] ?? [];
  return list.map((s) => {
    const c = localToWorld(f.x, f.z, f.rotDeg, s.x, s.z);
    return {
      rect: box(c.x, c.z, s.w, s.d, f.rotDeg) as Extract<Obstacle, { kind: 'box' }>,
      y: f.y + s.y,
      placement: s.placement,
    };
  });
}

function insideBox(
  inner: Extract<Obstacle, { kind: 'box' }>,
  outer: Extract<Obstacle, { kind: 'box' }>,
): boolean {
  return corners(inner).every(([x, z]) => distanceTo(x, z, outer) <= 0.002);
}

function checkSurface(
  content: Content,
  world: World,
  cand: Candidate,
  type: FurnitureType,
  placement: Placement,
  ignore: ReadonlySet<string>,
): Verdict {
  const support =
    cand.support === null ? undefined : world.furniture.find((f) => f.id === cand.support);
  if (support === undefined || ignore.has(support.id))
    return refuse('Ça se pose sur une table, une étagère ou le comptoir.');
  const wantCounter = placement === 'counter' || placement === 'counter_tip';
  const fp = footprintOf(type, cand.x, cand.z, cand.rotDeg);
  const surface = surfacesOf(content, support).find(
    (s) => Math.abs(s.y - cand.y) < 0.01 && (!wantCounter || s.placement === 'counter'),
  );
  if (surface === undefined)
    return refuse(
      wantCounter
        ? 'Ça se pose sur le comptoir, côté clients.'
        : 'Ça se pose sur une table, une étagère ou le comptoir.',
    );
  if (!insideBox(fp, surface.rect)) return refuse('Ça dépasse du bord.');
  for (const f of world.furniture) {
    if (ignore.has(f.id) || f.id === support.id) continue;
    const t = content.furniture.get(f.type);
    if (t === undefined) continue;
    if (
      f.y < cand.y + type.height &&
      f.y + t.height > cand.y + 0.01 &&
      overlaps(fp, footprintOf(t, f.x, f.z, f.rotDeg))
    )
      return refuse(`La place est prise : ${t.label.toLowerCase()}.`);
  }
  const supportType = content.furniture.get(support.type);
  for (const slot of supportType?.slots ?? []) {
    if (Math.abs(support.y + slot.y - cand.y) > 0.02) continue;
    const p = localToWorld(support.x, support.z, support.rotDeg, slot.x, slot.z);
    if (overlaps(fp, { kind: 'disc', x: p.x, z: p.z, r: 0.08 }))
      return refuse(
        'Laisse la place des tasses.',
        'Chaque table garde ses places pour le service.',
      );
  }
  return { ok: true, rotDeg: norm(cand.rotDeg), reorient: [] };
}

/** Fenêtres où poser des pots (appui) ou des lettres (vitrine): rectangle et hauteur d'appui. */
export function windowsOf(
  content: Content,
  world: World,
): { id: string; rect: Rect; sill: number }[] {
  const plan = currentPlan(content, world);
  const salle = content.arrangement.rooms.find((r) => r.extension === null && !r.outdoor);
  const out: { id: string; rect: Rect; sill: number }[] = [];
  for (const el of plan.levels[0]?.elements ?? []) {
    if (el.kind !== 'window' || !('rect' in el.shape)) continue;
    const r = el.shape.rect;
    const sill = el.sill ?? 0.9;
    if (
      salle !== undefined &&
      Math.abs(r[1] - (salle.space[1] + salle.space[3])) < 0.06 &&
      sill <= 1
    )
      out.push({ id: el.id, rect: r, sill });
  }
  return out;
}

function checkWindow(
  content: Content,
  world: World,
  cand: Candidate,
  type: FurnitureType,
  ignore: ReadonlySet<string>,
  mount: 'sill' | 'vitrine',
): Verdict {
  const fp = footprintOf(type, cand.x, cand.z, cand.rotDeg);
  const win = windowsOf(content, world).find((w) => insideBox(fp, rectBox(w.rect)));
  if (win === undefined)
    return refuse(
      mount === 'sill'
        ? 'Ça se pose sur l’appui de la vitrine.'
        : 'Ça se pose sur la vitre de la vitrine.',
    );
  const y = mount === 'sill' ? win.sill : content.arrangement.rules.vitrineY;
  if (Math.abs(cand.y - y) > 0.02) return refuse('Ça se pose sur l’appui de la vitrine.');
  for (const f of piecesOn(world, ignore, (f) => mountOf(placementOf(content, f.type)) === mount)) {
    const t = content.furniture.get(f.type);
    if (t !== undefined && overlaps(fp, footprintOf(t, f.x, f.z, f.rotDeg)))
      return refuse(`La place est prise : ${t.label.toLowerCase()}.`);
  }
  return { ok: true, rotDeg: norm(cand.rotDeg), reorient: [] };
}
