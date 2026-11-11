/**
 * Files de modules (haies, talus, rangs du labour) et poses des repères livrés: ce que le rendu
 * encré tire de la carte d'un grand lieu, sans Three.js. Une case de file reçoit un module d'un
 * mètre choisi d'après ses voisines (droit, bout, angle, quart de tour, côté de l'eau); la forme
 * tirée, la file à laquelle elle appartient et sa pièce de contour ne dépendent que de la carte:
 * l'hôte et l'invité voient la même haie, d'une tuile à l'autre. Un repère prend le modèle de sa
 * nature, orienté par la voie ou l'eau qui le justifie. Données: `reglages-files.ts`.
 */
import type { MapDef } from '../../donnees/schemas/lieu';
import { DECOR_MANIFEST, type DecorManifest, variantOf } from './decors-manifeste';
import type { Footprint } from './emprises';
import {
  LANDMARK_LOOKS,
  type LandmarkLook,
  RUN_SORTS,
  type RunSort,
  type Side4,
  type Side8,
} from './reglages-files';
import { type GroundField, hash01 } from './terrain-rendu';
import { tileRect } from './tuiles';

/** Une case de file: le module posé, tourné de `quarter` quarts de tour, et sa file. */
export interface RunCell {
  readonly sort: string;
  readonly x: number;
  readonly y: number;
  /** Modèle montré (variante comprise). */
  readonly model: string;
  /** Quarts de tour autour de y (sens de `Object3D.rotation.y`). */
  readonly quarter: 0 | 1 | 2 | 3;
  /** Posé en miroir (x changé de signe avant la rotation). */
  readonly mirror: boolean;
  /** Numéro de pièce de contour de sa file (1 à 62): le même sur toute la file. */
  readonly piece: number;
}

const OFFSETS: Readonly<Record<Side8, readonly [number, number]>> = {
  n: [0, -1],
  s: [0, 1],
  e: [1, 0],
  w: [-1, 0],
  ne: [1, -1],
  nw: [-1, -1],
  se: [1, 1],
  sw: [-1, 1],
};
const SIDES4: readonly Side4[] = ['n', 's', 'e', 'w'];

/**
 * Direction locale tournée de `quarter` quarts de tour (même sens que `rotation.y` de Three.js),
 * après le miroir est-ouest s'il y en a un.
 */
export function turned(side: Side8, quarter: number, mirror = false): readonly [number, number] {
  let [x, z] = OFFSETS[side];
  if (mirror) x = -x;
  for (let k = 0; k < quarter; k++) [x, z] = [z, -x];
  // Pas de zéro négatif: la direction sert de clé de comparaison.
  return [x + 0, z + 0];
}

function sideAt(dx: number, dz: number): Side4 | null {
  for (const side of SIDES4) {
    const [ox, oz] = OFFSETS[side];
    if (ox === dx && oz === dz) return side;
  }
  return null;
}

/** Toutes les files d'un lieu, rangées par case (index `y * width + x`). */
export class RunLayout {
  readonly cells = new Map<number, RunCell>();

  constructor(readonly width: number) {}

  /** La case porte-t-elle un module de file ? (le décor provisoire n'y pose plus de boîte) */
  covers(x: number, y: number): boolean {
    return this.cells.has(y * this.width + x);
  }

  /** Cases de file d'une tuile, par sorte (une sorte, un maillage fusionné). */
  inTile(map: Pick<MapDef, 'width' | 'height'>, tile: number): Map<string, RunCell[]> {
    const { x0, y0, x1, y1 } = tileRect(map, tile);
    const out = new Map<string, RunCell[]>();
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const cell = this.cells.get(y * this.width + x);
        if (cell === undefined) continue;
        const list = out.get(cell.sort) ?? [];
        list.push(cell);
        out.set(cell.sort, list);
      }
    return out;
  }

  /**
   * Emprise de chaque module posé (semis, objets au sol): sa taille au manifeste, tournée. Les
   * modules plus bas que `minHeight` sont laissés de côté.
   */
  footprints(manifest: DecorManifest = DECOR_MANIFEST, minHeight = 0): Footprint[] {
    const out: Footprint[] = [];
    for (const cell of this.cells.values()) {
      const size = manifest.models[cell.model]?.size;
      if (size === undefined || size.h < minHeight) continue;
      const across = cell.quarter % 2 === 1;
      const w = across ? size.d : size.w;
      const d = across ? size.w : size.d;
      const cx = cell.x + 0.5;
      const cz = cell.y + 0.5;
      out.push({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2 });
    }
    return out;
  }
}

const tallCache = new WeakMap<object, Footprint[]>();

/**
 * Emprises des modules de file et des repères livrés d'une carte à terrain plus hauts que
 * `height` (une haie, un talus, un château d'eau; pas un rang de culture): un objet posé au sol
 * n'y disparaît pas. Calculées une fois par carte.
 */
export function tallFootprints(
  map: Pick<MapDef, 'terrain' | 'width' | 'height' | 'landmarks' | 'rails'>,
  field: () => GroundField,
  height: number,
  manifest: DecorManifest = DECOR_MANIFEST,
): Footprint[] {
  const known = tallCache.get(map);
  if (known !== undefined) return known;
  const out: Footprint[] = [];
  if (map.terrain !== undefined) {
    const ground = field();
    const layout = layRuns(ground, RUN_SORTS, manifest);
    out.push(...layout.footprints(manifest, height));
    for (const pose of landmarkPoses(map, ground, () => true, LANDMARK_LOOKS, manifest))
      out.push(pose.footprint);
  }
  tallCache.set(map, out);
  return out;
}

/** Vrai si toutes les formes (variantes comprises) des modules de la sorte sont livrées. */
export function sortAvailable(
  sort: RunSort,
  has: (model: string) => boolean,
  manifest: DecorManifest = DECOR_MANIFEST,
): boolean {
  return sort.modules.every((m) =>
    [m.model, ...(manifest.models[m.model]?.variants ?? [])].every(
      (id) => manifest.models[id] !== undefined && has(id),
    ),
  );
}

/**
 * Pose les files du lieu. `sorts`: les sortes à poser (celles dont les modèles sont livrés), dans
 * l'ordre de priorité; une case appartient à la première sorte qui la prend.
 */
export function layRuns(
  field: GroundField,
  sorts: Readonly<Record<string, RunSort>> = RUN_SORTS,
  manifest: DecorManifest = DECOR_MANIFEST,
): RunLayout {
  const { width, height, names, cells } = field;
  const layout = new RunLayout(width);
  const nameAt = (x: number, y: number): string =>
    x < 0 || y < 0 || x >= width || y >= height ? '' : (names[cells[y * width + x] ?? 0] ?? '');
  const owner = new Map<number, string>();
  for (const [id, sort] of Object.entries(sorts))
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (owner.has(i) || !sort.on.includes(nameAt(x, y))) continue;
        if (sort.every !== undefined) {
          const along = sort.every.axis === 'x' ? x : y;
          if (along % sort.every.step !== 0) continue;
        }
        const near = sort.near;
        if (
          near !== undefined &&
          !Object.values(OFFSETS).some(([dx, dz]) => near.includes(nameAt(x + dx, y + dz)))
        )
          continue;
        const notNear = sort.notNear;
        if (
          notNear !== undefined &&
          SIDES4.some((side) => {
            const [dx, dz] = OFFSETS[side];
            return notNear.includes(nameAt(x + dx, y + dz));
          })
        )
          continue;
        owner.set(i, id);
      }

  // Files: suites de cases de la même sorte reliées par un côté. Leur numéro de pièce vient de
  // leur première case: le même dans toutes les tuiles qu'elles traversent.
  const runOf = new Map<number, number>();
  for (const start of [...owner.keys()].sort((a, b) => a - b)) {
    if (runOf.has(start)) continue;
    const sort = owner.get(start);
    const queue = [start];
    runOf.set(start, start);
    for (const i of queue) {
      const x = i % width;
      const y = Math.floor(i / width);
      for (const side of SIDES4) {
        const [dx, dz] = OFFSETS[side];
        const nx = x + dx;
        const ny = y + dz;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const j = ny * width + nx;
        if (owner.get(j) === sort && !runOf.has(j)) {
          runOf.set(j, start);
          queue.push(j);
        }
      }
    }
  }

  for (const [i, id] of owner) {
    const sort = sorts[id];
    if (sort === undefined) continue;
    const x = i % width;
    const y = Math.floor(i / width);
    const linked = new Set<Side4>();
    for (const side of SIDES4) {
      const [dx, dz] = OFFSETS[side];
      if (owner.get((y + dz) * width + x + dx) === id && x + dx >= 0 && x + dx < width)
        linked.add(side);
    }
    const facing = sort.facing ?? [];
    let best: { model: string; quarter: 0 | 1 | 2 | 3; mirror: boolean; score: number } | null =
      null;
    const faces = (dx: number, dz: number): boolean => facing.includes(nameAt(x + dx, y + dz));
    for (const module of sort.modules)
      for (const mirror of module.mirror === true ? [false, true] : [false])
        for (const quarter of [0, 1, 2, 3] as const) {
          let score = 0;
          const reach = new Set<Side4>();
          for (const link of module.links) {
            const side = sideAt(...turned(link, quarter, mirror));
            if (side !== null) reach.add(side);
          }
          // Un raccord ouvert vers une case vide laisserait voir le profil coupé du module.
          for (const side of SIDES4)
            if (linked.has(side)) score += reach.has(side) ? 2 : -1;
            else if (reach.has(side)) score -= 4;
          for (const side of module.facing ?? []) {
            const [dx, dz] = turned(side, quarter, mirror);
            // Un côté droit dont seul un coin touche l'eau: une berge en escalier.
            const corner =
              dx === 0
                ? faces(-1, dz) || faces(1, dz)
                : dz === 0
                  ? faces(dx, -1) || faces(dx, 1)
                  : false;
            score += faces(dx, dz) ? 3 : corner ? 1 : -3;
          }
          if (best === null || score > best.score)
            best = { model: module.model, quarter, mirror, score };
        }
    if (best === null) continue;
    const run = runOf.get(i) ?? i;
    layout.cells.set(i, {
      sort: id,
      x,
      y,
      model: variantOf(best.model, `${id}:${String(x)}:${String(y)}`, manifest),
      quarter: best.quarter,
      mirror: best.mirror,
      piece: 1 + Math.floor(hash01(run % width, Math.floor(run / width), 61) * 62),
    });
  }
  return layout;
}

// ---- Repères livrés ----

/** Un repère posé en modèle livré: point, cap, échelle, emprise. */
export interface LandmarkPose {
  readonly id: string;
  readonly model: string;
  readonly x: number;
  readonly z: number;
  /** Cap (radians, sens de `rotation.y`). */
  readonly yaw: number;
  readonly scale: number;
  readonly sink: number;
  readonly footprint: Footprint;
}

interface Segment {
  readonly ax: number;
  readonly ay: number;
  readonly bx: number;
  readonly by: number;
}

/** Segments des voies à ciel ouvert (les tunnels ne comptent pas: on ne s'oriente pas sur eux). */
function openRails(map: Pick<MapDef, 'rails'>): Segment[] {
  const out: Segment[] = [];
  for (const track of map.rails ?? []) {
    if (track.tunnel === true) continue;
    for (let i = 0; i + 1 < track.points.length; i++) {
      const a = track.points[i];
      const b = track.points[i + 1];
      if (a !== undefined && b !== undefined) out.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1] });
    }
  }
  return out;
}

/** Le point le plus proche de (x, y) sur les voies, et le segment qui le porte. */
function nearestRail(
  segments: readonly Segment[],
  x: number,
  y: number,
): { px: number; py: number; segment: Segment } | null {
  let best: { px: number; py: number; segment: Segment; d: number } | null = null;
  for (const segment of segments) {
    const { ax, ay, bx, by } = segment;
    const lx = bx - ax;
    const ly = by - ay;
    const length2 = lx * lx + ly * ly;
    const t =
      length2 === 0 ? 0 : Math.min(1, Math.max(0, ((x - ax) * lx + (y - ay) * ly) / length2));
    const px = ax + lx * t;
    const py = ay + ly * t;
    const d = Math.hypot(px - x, py - y);
    if (best === null || d < best.d) best = { px, py, segment, d };
  }
  return best;
}

/** Cap qui tourne l'avant (+z) du modèle vers la direction (dx, dz). */
function yawToward(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}

/** Cap d'un repère d'après sa règle et les données du lieu; `null` si elles ne la permettent pas. */
export function landmarkYaw(
  look: LandmarkLook,
  map: Pick<MapDef, 'rails'>,
  field: GroundField,
  x: number,
  y: number,
): number | null {
  const facing = look.facing;
  let yaw: number;
  if (facing.rule === 'fixed') yaw = facing.yaw;
  else if (facing.rule === 'along-water') {
    // Axe principal des cases d'eau autour du repère (moments d'ordre deux).
    const { width, height, names, cells } = field;
    let n = 0;
    let mx = 0;
    let mz = 0;
    const points: [number, number][] = [];
    for (let j = Math.floor(y - facing.radius); j <= Math.floor(y + facing.radius); j++)
      for (let i = Math.floor(x - facing.radius); i <= Math.floor(x + facing.radius); i++) {
        if (i < 0 || j < 0 || i >= width || j >= height) continue;
        if (names[cells[j * width + i] ?? 0] !== 'eau') continue;
        points.push([i + 0.5, j + 0.5]);
        mx += i + 0.5;
        mz += j + 0.5;
        n += 1;
      }
    if (n < 3) return null;
    mx /= n;
    mz /= n;
    let sxx = 0;
    let szz = 0;
    let sxz = 0;
    for (const [px, pz] of points) {
      sxx += (px - mx) ** 2;
      szz += (pz - mz) ** 2;
      sxz += (px - mx) * (pz - mz);
    }
    const axis = 0.5 * Math.atan2(2 * sxz, sxx - szz);
    // L'axe x du modèle le long de l'eau: +x tourné de `yaw` vaut (cos yaw, -sin yaw).
    yaw = -axis;
    // L'avant (+z, soit (sin yaw, cos yaw)) du côté du sud.
    if (Math.cos(yaw) < 0) yaw += Math.PI;
  } else {
    const near = nearestRail(openRails(map), x, y);
    if (near === null) return null;
    if (facing.rule === 'toward-rail') yaw = yawToward(near.px - x, near.py - y);
    else {
      const { ax, ay, bx, by } = near.segment;
      const length = Math.hypot(bx - ax, by - ay) || 1;
      let tx = (bx - ax) / length;
      let ty = (by - ay) / length;
      // L'avant vers la ligne qui arrive: le milieu du segment, vu du repère.
      if (tx * ((ax + bx) / 2 - x) + ty * ((ay + by) / 2 - y) < 0) {
        tx = -tx;
        ty = -ty;
      }
      yaw = yawToward(tx, ty);
    }
  }
  if (look.snap === true) yaw = Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2);
  return yaw;
}

/**
 * Repères du lieu dessinés par un modèle livré (`LANDMARK_LOOKS`, par nature). `has`: le modèle
 * est chargé. Un repère sans nature connue, sans modèle ou sans orientation possible reste au
 * volume provisoire du moteur.
 */
export function landmarkPoses(
  map: Pick<MapDef, 'landmarks' | 'rails'>,
  field: GroundField,
  has: (model: string) => boolean,
  looks: Readonly<Record<string, LandmarkLook>> = LANDMARK_LOOKS,
  manifest: DecorManifest = DECOR_MANIFEST,
): LandmarkPose[] {
  const out: LandmarkPose[] = [];
  for (const [id, mark] of Object.entries(map.landmarks ?? {})) {
    const look = mark.kind === undefined ? undefined : looks[mark.kind];
    if (look === undefined || !has(look.model)) continue;
    const size = manifest.models[look.model]?.size;
    if (size === undefined) continue;
    const yaw = landmarkYaw(look, map, field, mark.x, mark.y);
    if (yaw === null) continue;
    const scale = look.fitHeight === true && size.h > 0 ? mark.height / size.h : 1;
    // Emprise: le rectangle du modèle tourné, dans une boîte alignée sur la grille.
    const c = Math.abs(Math.cos(yaw));
    const s = Math.abs(Math.sin(yaw));
    const hw = ((size.w * c + size.d * s) * scale) / 2;
    const hd = ((size.w * s + size.d * c) * scale) / 2;
    out.push({
      id,
      model: look.model,
      x: mark.x,
      z: mark.y,
      yaw,
      scale,
      sink: look.sink,
      footprint: { x0: mark.x - hw, z0: mark.y - hd, x1: mark.x + hw, z1: mark.y + hd },
    });
  }
  return out;
}
