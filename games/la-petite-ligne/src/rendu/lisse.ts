/**
 * Style `lisse` des personnages (étape A du plan de qualité visuelle, chantiers 1 et 3):
 * traitement des maillages au chargement, sans toucher aux fichiers de l'artiste.
 *
 * - `smoothCharacterNormals`: les modèles arrivent ombrés par face (un sommet par face et par
 *   coin, normale de la face). On moyenne, pour chaque coin, les faces qui touchent le même point
 *   et dont la normale reste à moins de l'angle de lissage de la sienne, pondérées par l'angle
 *   qu'elles font en ce point: une face découpée en triangles pèse autant qu'entière, quel que
 *   soit le découpage (une pondération par la surface des triangles compterait deux fois la face
 *   d'un quadrilatère au bout de sa diagonale et tordrait la normale). Les arêtes plus ouvertes
 *   (bord de chapeau, semelle) restent vives. La topologie ne change pas: index, UV, poids de
 *   peau et cibles de morphose restent valables, et les fusions de l'habillage aussi.
 * - `buildOutlineGeometry`: géométrie de la coque du contour (`contour.ts`), qui partage les
 *   tampons du corps (positions, UV, poids) et ajoute `outlineNormal`, une normale moyenne par
 *   point sans aucune arête: la coque gonflée le long de ces normales reste fermée aux arêtes
 *   vives. Les petites îles (traits du visage, boutons) en sont retirées.
 */
import {
  BufferGeometry,
  Float32BufferAttribute,
  Uint16BufferAttribute,
  Uint32BufferAttribute,
  type BufferAttribute,
} from 'three';

/** Précision de la soudure des points (m): les sommets séparés par face sont au même endroit à 0,1 mm près. */
const WELD_STEP = 1e-4;
const VECTOR_SIZE = 3;
const TRIANGLE = 3;
const UINT16_LIMIT = 65_535;
const DEGREE = Math.PI / 180;

/** Sommets d'un triangle (index de la géométrie, ou suite des sommets sans index). */
function cornerOf(index: BufferAttribute | null, triangle: number, corner: number): number {
  const at = triangle * TRIANGLE + corner;
  return index === null ? at : index.getX(at);
}

interface Welded {
  /** Point soudé de chaque sommet. */
  point: Int32Array;
  points: number;
}

/** Regroupe les sommets qui sont au même endroit. */
function weldPoints(geometry: BufferGeometry): Welded {
  const position = geometry.getAttribute('position');
  const point = new Int32Array(position.count);
  const known = new Map<string, number>();
  for (let i = 0; i < position.count; i += 1) {
    const key = `${Math.round(position.getX(i) / WELD_STEP)},${Math.round(position.getY(i) / WELD_STEP)},${Math.round(position.getZ(i) / WELD_STEP)}`;
    let id = known.get(key);
    if (id === undefined) {
      id = known.size;
      known.set(key, id);
    }
    point[i] = id;
  }
  return { point, points: known.size };
}

/** Normales unitaires des triangles (nulles pour un triangle sans surface). */
function faceNormals(geometry: BufferGeometry, triangles: number): Float32Array {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const normals = new Float32Array(triangles * VECTOR_SIZE);
  for (let t = 0; t < triangles; t += 1) {
    const a = cornerOf(index, t, 0);
    const b = cornerOf(index, t, 1);
    const c = cornerOf(index, t, 2);
    const abx = position.getX(b) - position.getX(a);
    const aby = position.getY(b) - position.getY(a);
    const abz = position.getZ(b) - position.getZ(a);
    const acx = position.getX(c) - position.getX(a);
    const acy = position.getY(c) - position.getY(a);
    const acz = position.getZ(c) - position.getZ(a);
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    const length = Math.hypot(nx, ny, nz);
    if (length === 0) continue;
    normals[t * VECTOR_SIZE] = nx / length;
    normals[t * VECTOR_SIZE + 1] = ny / length;
    normals[t * VECTOR_SIZE + 2] = nz / length;
  }
  return normals;
}

/** Angle de chaque coin de chaque triangle (radians), rangé à `triangle * 3 + coin`. */
function cornerAngles(geometry: BufferGeometry, triangles: number): Float32Array {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const angles = new Float32Array(triangles * TRIANGLE);
  for (let t = 0; t < triangles; t += 1) {
    for (let c = 0; c < TRIANGLE; c += 1) {
      const o = cornerOf(index, t, c);
      const a = cornerOf(index, t, (c + 1) % TRIANGLE);
      const b = cornerOf(index, t, (c + 2) % TRIANGLE);
      const ax = position.getX(a) - position.getX(o);
      const ay = position.getY(a) - position.getY(o);
      const az = position.getZ(a) - position.getZ(o);
      const bx = position.getX(b) - position.getX(o);
      const by = position.getY(b) - position.getY(o);
      const bz = position.getZ(b) - position.getZ(o);
      const la = Math.hypot(ax, ay, az);
      const lb = Math.hypot(bx, by, bz);
      if (la === 0 || lb === 0) continue;
      angles[t * TRIANGLE + c] = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by + az * bz) / (la * lb))));
    }
  }
  return angles;
}

/**
 * Coins de triangle posés sur chaque point soudé (table compacte: début de chaque point, puis la
 * liste des coins, `triangle * 3 + coin`).
 */
function cornersByPoint(
  geometry: BufferGeometry,
  welded: Welded,
  triangles: number,
): { start: Int32Array; list: Int32Array } {
  const index = geometry.getIndex();
  const start = new Int32Array(welded.points + 1);
  for (let t = 0; t < triangles; t += 1) {
    for (let c = 0; c < TRIANGLE; c += 1) {
      const p = welded.point[cornerOf(index, t, c)] ?? 0;
      start[p + 1] = (start[p + 1] ?? 0) + 1;
    }
  }
  for (let p = 0; p < welded.points; p += 1) start[p + 1] = (start[p + 1] ?? 0) + (start[p] ?? 0);
  const fill = start.slice(0, welded.points);
  const list = new Int32Array(triangles * TRIANGLE);
  for (let t = 0; t < triangles; t += 1) {
    for (let c = 0; c < TRIANGLE; c += 1) {
      const p = welded.point[cornerOf(index, t, c)] ?? 0;
      const slot = fill[p] ?? 0;
      list[slot] = t * TRIANGLE + c;
      fill[p] = slot + 1;
    }
  }
  return { start, list };
}

function triangleCount(geometry: BufferGeometry): number {
  const index = geometry.getIndex();
  return Math.floor((index === null ? geometry.getAttribute('position').count : index.count) / TRIANGLE);
}

/**
 * Lisse les normales d'un maillage ombré par face, en gardant les arêtes plus ouvertes que
 * `creaseDegrees`. Modifie l'attribut `normal` en place (copie neuve si absent).
 */
export function smoothCharacterNormals(geometry: BufferGeometry, creaseDegrees: number): void {
  const position = geometry.getAttribute('position');
  if (position.count === 0) return;
  if (!geometry.hasAttribute('normal')) geometry.computeVertexNormals();
  const normal = geometry.getAttribute('normal');
  const triangles = triangleCount(geometry);
  const welded = weldPoints(geometry);
  const faces = faceNormals(geometry, triangles);
  const angles = cornerAngles(geometry, triangles);
  const touching = cornersByPoint(geometry, welded, triangles);
  const cosCrease = Math.cos(creaseDegrees * DEGREE);
  const out = new Float32Array(position.count * VECTOR_SIZE);
  for (let v = 0; v < position.count; v += 1) {
    const rx = normal.getX(v);
    const ry = normal.getY(v);
    const rz = normal.getZ(v);
    const p = welded.point[v] ?? 0;
    let sx = 0;
    let sy = 0;
    let sz = 0;
    for (let k = touching.start[p] ?? 0; k < (touching.start[p + 1] ?? 0); k += 1) {
      const corner = touching.list[k] ?? 0;
      const t = Math.floor(corner / TRIANGLE);
      const fx = faces[t * VECTOR_SIZE] ?? 0;
      const fy = faces[t * VECTOR_SIZE + 1] ?? 0;
      const fz = faces[t * VECTOR_SIZE + 2] ?? 0;
      if (fx * rx + fy * ry + fz * rz < cosCrease) continue;
      const weight = angles[corner] ?? 0;
      sx += fx * weight;
      sy += fy * weight;
      sz += fz * weight;
    }
    const length = Math.hypot(sx, sy, sz);
    if (length > 0) {
      out[v * VECTOR_SIZE] = sx / length;
      out[v * VECTOR_SIZE + 1] = sy / length;
      out[v * VECTOR_SIZE + 2] = sz / length;
    } else {
      out[v * VECTOR_SIZE] = rx;
      out[v * VECTOR_SIZE + 1] = ry;
      out[v * VECTOR_SIZE + 2] = rz;
    }
  }
  geometry.setAttribute('normal', new Float32BufferAttribute(out, VECTOR_SIZE));
}

/** Attributs du corps que la coque lit (les mêmes tampons: rien n'est copié). */
const SHARED_ATTRIBUTES = ['position', 'uv', 'skinIndex', 'skinWeight'] as const;

/** Nom de l'attribut des normales de gonflement de la coque. */
export const OUTLINE_NORMAL = 'outlineNormal';

/**
 * Géométrie de la coque d'un maillage de personnage: mêmes tampons que `source`, normales de
 * gonflement sans arête, triangles des îles plus petites que `skipIslandsBelow` (diagonale de
 * leur boîte, m) retirés.
 */
export function buildOutlineGeometry(source: BufferGeometry, skipIslandsBelow: number): BufferGeometry {
  const position = source.getAttribute('position');
  const index = source.getIndex();
  const triangles = triangleCount(source);
  const welded = weldPoints(source);
  const faces = faceNormals(source, triangles);
  const angles = cornerAngles(source, triangles);

  // Normale moyenne par point, toutes faces confondues (pondérées par leur angle en ce point).
  const pointNormals = new Float32Array(welded.points * VECTOR_SIZE);
  for (let t = 0; t < triangles; t += 1) {
    for (let c = 0; c < TRIANGLE; c += 1) {
      const p = welded.point[cornerOf(index, t, c)] ?? 0;
      const weight = angles[t * TRIANGLE + c] ?? 0;
      for (let k = 0; k < VECTOR_SIZE; k += 1) {
        pointNormals[p * VECTOR_SIZE + k] = (pointNormals[p * VECTOR_SIZE + k] ?? 0) + (faces[t * VECTOR_SIZE + k] ?? 0) * weight;
      }
    }
  }
  const normals = new Float32Array(position.count * VECTOR_SIZE);
  for (let v = 0; v < position.count; v += 1) {
    const p = welded.point[v] ?? 0;
    const x = pointNormals[p * VECTOR_SIZE] ?? 0;
    const y = pointNormals[p * VECTOR_SIZE + 1] ?? 0;
    const z = pointNormals[p * VECTOR_SIZE + 2] ?? 0;
    const length = Math.hypot(x, y, z) || 1;
    normals[v * VECTOR_SIZE] = x / length;
    normals[v * VECTOR_SIZE + 1] = y / length;
    normals[v * VECTOR_SIZE + 2] = z / length;
  }

  // Îles: points reliés par des triangles (union de leurs ensembles).
  const parent = new Int32Array(welded.points);
  for (let p = 0; p < welded.points; p += 1) parent[p] = p;
  const find = (p: number): number => {
    let root = p;
    while ((parent[root] ?? root) !== root) root = parent[root] ?? root;
    let walk = p;
    while ((parent[walk] ?? walk) !== root) {
      const next = parent[walk] ?? root;
      parent[walk] = root;
      walk = next;
    }
    return root;
  };
  for (let t = 0; t < triangles; t += 1) {
    const a = find(welded.point[cornerOf(index, t, 0)] ?? 0);
    const b = find(welded.point[cornerOf(index, t, 1)] ?? 0);
    const c = find(welded.point[cornerOf(index, t, 2)] ?? 0);
    parent[b] = a;
    parent[find(c)] = a;
  }
  const boxes = new Map<number, [number, number, number, number, number, number]>();
  for (let v = 0; v < position.count; v += 1) {
    const root = find(welded.point[v] ?? 0);
    const x = position.getX(v);
    const y = position.getY(v);
    const z = position.getZ(v);
    const box = boxes.get(root);
    if (box === undefined) {
      boxes.set(root, [x, y, z, x, y, z]);
    } else {
      box[0] = Math.min(box[0], x);
      box[1] = Math.min(box[1], y);
      box[2] = Math.min(box[2], z);
      box[3] = Math.max(box[3], x);
      box[4] = Math.max(box[4], y);
      box[5] = Math.max(box[5], z);
    }
  }
  const small = new Set<number>();
  for (const [root, box] of boxes) {
    if (Math.hypot(box[3] - box[0], box[4] - box[1], box[5] - box[2]) < skipIslandsBelow) small.add(root);
  }
  const kept: number[] = [];
  for (let t = 0; t < triangles; t += 1) {
    const a = cornerOf(index, t, 0);
    if (small.has(find(welded.point[a] ?? 0))) continue;
    kept.push(a, cornerOf(index, t, 1), cornerOf(index, t, 2));
  }

  const hull = new BufferGeometry();
  hull.name = `${source.name} (contour)`;
  for (const name of SHARED_ATTRIBUTES) {
    if (source.hasAttribute(name)) hull.setAttribute(name, source.getAttribute(name));
  }
  hull.setAttribute(OUTLINE_NORMAL, new Float32BufferAttribute(normals, VECTOR_SIZE));
  hull.setIndex(
    position.count > UINT16_LIMIT ? new Uint32BufferAttribute(kept, 1) : new Uint16BufferAttribute(kept, 1),
  );
  return hull;
}
