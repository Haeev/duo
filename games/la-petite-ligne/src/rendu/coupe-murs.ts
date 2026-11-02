/**
 * Pied des murs coupés (retour R12 du 2026-11-01: « dans la maison, on ne voit plus où est
 * exactement la porte »). Quand on entre, les murs tournés vers la caméra disparaissent; on
 * en garde le pied, à hauteur de plinthe: le tour de la pièce reste lisible, et l'ouverture de
 * la porte, sans maçonnerie sous elle, reste une brèche nette entre ses deux jambages.
 *
 * La géométrie vient du mur lui-même (pas d'une boîte): épaisseur, chaînes d'angle et
 * jambages exacts. Chaque sommet est ramené sous la hauteur de coupe; les faces entièrement
 * au-dessus disparaissent, sauf celles tournées vers le haut (dessus du mur), qui, écrasées,
 * forment le chapeau du pied de mur. Ce chapeau est découpé aux tronçons où la maçonnerie
 * descend jusqu'à la coupe (rien au-dessus de la porte) et à la section du mur (rien de ce qui
 * dépasse de la façade: appuis, jardinières). Le dessus du mur, le plus haut, passe un rien
 * au-dessus des autres faces écrasées au même niveau: aucun scintillement entre elles.
 */
import {
  BufferGeometry,
  Float32BufferAttribute,
  Vector3,
  type BufferAttribute,
  type Matrix4,
  type Object3D,
} from 'three';

/** Écart vertical maximal entre faces écrasées au même niveau (m): départage la profondeur. */
const CAP_SPREAD = 0.003;
/** Une face « regarde vers le haut » au-delà de ce cosinus. */
const UPWARD = 0.5;
const TRIANGLE = 3;
/** Marge autour de la section du mur pour garder une face écrasée (m). */
const SECTION_SLACK = 0.01;

/** Un sommet de sortie: position dans le repère du modèle et valeurs de chaque attribut. */
interface Corner {
  p: Vector3;
  values: number[][];
}

function lerpCorner(a: Corner, b: Corner, t: number): Corner {
  return {
    p: a.p.clone().lerp(b.p, t),
    values: a.values.map((value, i) => value.map((v, j) => v + ((b.values[i]?.[j] ?? v) - v) * t)),
  };
}

/** Garde la partie du polygone où `axis` est entre `low` et `high` (deux plans de coupe). */
function clipAlong(polygon: Corner[], axis: 'x' | 'z', low: number, high: number): Corner[] {
  let out = polygon;
  for (const [bound, keepAbove] of [
    [low, true],
    [high, false],
  ] as const) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i += 1) {
      const a = input[i];
      const b = input[(i + 1) % input.length];
      if (a === undefined || b === undefined) continue;
      const da = keepAbove ? a.p[axis] - bound : bound - a.p[axis];
      const db = keepAbove ? b.p[axis] - bound : bound - b.p[axis];
      if (da >= 0) out.push(a);
      if (da >= 0 !== db >= 0) out.push(lerpCorner(a, b, da / (da - db)));
    }
  }
  return out;
}

/** Réunit des intervalles qui se chevauchent (triés). */
function mergeSpans(spans: [number, number][]): [number, number][] {
  const sorted = [...spans].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const span of sorted) {
    const last = merged[merged.length - 1];
    if (last !== undefined && span[0] <= last[1] + SECTION_SLACK) {
      last[1] = Math.max(last[1], span[1]);
    } else {
      merged.push([span[0], span[1]]);
    }
  }
  return merged;
}

/**
 * Baie à ouvrir dans le pied du mur (repère du modèle), le long de `axis` de `low` à `high`.
 * Les murs de l'artiste sont des dalles pleines: la porte n'est qu'un panneau posé sur la face
 * extérieure. Le pied y descend au seuil (`sill`), entre deux jambages.
 */
export interface WallOpening {
  readonly axis: 'x' | 'z';
  readonly low: number;
  readonly high: number;
  readonly sill: number;
}

type Face =
  | { kind: 'low'; corners: Corner[]; limit: number }
  | { kind: 'cap'; corners: Corner[]; mean: number }
  | { kind: 'flat'; corners: Corner[]; normal: Vector3 };

/** Triangles en éventail d'un polygone convexe (sens conservé). */
function fan(polygon: Corner[]): Corner[][] {
  const out: Corner[][] = [];
  const first = polygon[0];
  for (let i = 1; first !== undefined && i + 1 < polygon.length; i += 1) {
    const b = polygon[i];
    const c = polygon[i + 1];
    if (b !== undefined && c !== undefined) out.push([first, b, c]);
  }
  return out;
}

/** Parties d'un polygone hors de l'intervalle [low, high] le long de `axis`. */
function outside(polygon: Corner[], axis: 'x' | 'z', low: number, high: number): Corner[][] {
  return [
    clipAlong(polygon, axis, -Infinity, low),
    clipAlong(polygon, axis, high, Infinity),
  ].filter((part) => part.length >= TRIANGLE);
}

/**
 * Pied d'un mur coupé à `height` (repère du modèle, `toModel`: du maillage au modèle), avec ses
 * baies (`openings`). `null` si rien du mur n'est sous la hauteur de coupe.
 */
export function lowWallGeometry(
  source: BufferGeometry,
  toModel: Matrix4,
  height: number,
  openings: readonly WallOpening[] = [],
): BufferGeometry | null {
  const geometry = source.index === null ? source : source.toNonIndexed();
  const position = geometry.getAttribute('position') as BufferAttribute | undefined;
  if (position === undefined) {
    return null;
  }
  const names = Object.keys(geometry.attributes).filter((name) => name !== 'position');
  const attributes = names.map((name) => geometry.getAttribute(name) as BufferAttribute);
  const fromModel = toModel.clone().invert();
  const upLocal = new Vector3(0, 1, 0).transformDirection(fromModel);
  const count = position.count - (position.count % TRIANGLE);
  const corners: Corner[] = [];
  let top = -Infinity;
  for (let i = 0; i < count; i += 1) {
    const p = new Vector3().fromBufferAttribute(position, i).applyMatrix4(toModel);
    top = Math.max(top, p.y);
    corners.push({
      p,
      values: attributes.map((attribute) =>
        Array.from({ length: attribute.itemSize }, (_, j) => attribute.getComponent(i, j)),
      ),
    });
  }
  if (geometry !== source) {
    geometry.dispose();
  }

  const low: Corner[][] = [];
  const caps: Corner[][] = [];
  const edgeA = new Vector3();
  const edgeB = new Vector3();
  for (let t = 0; t < count; t += TRIANGLE) {
    const triangle = [corners[t], corners[t + 1], corners[t + 2]];
    const [a, b, c] = triangle;
    if (a === undefined || b === undefined || c === undefined) continue;
    if (a.p.y <= height || b.p.y <= height || c.p.y <= height) {
      low.push([a, b, c]);
    } else if (
      edgeA.subVectors(b.p, a.p).cross(edgeB.subVectors(c.p, a.p)).normalize().y > UPWARD
    ) {
      caps.push([a, b, c]);
    }
  }
  if (low.length === 0) {
    return null;
  }

  // Section du mur à la coupe (faces qui la traversent) et tronçons porteurs le long du mur.
  const section = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const triangle of low) {
    for (const corner of triangle) {
      if (corner.p.y < height) continue;
      section.minX = Math.min(section.minX, corner.p.x);
      section.maxX = Math.max(section.maxX, corner.p.x);
      section.minZ = Math.min(section.minZ, corner.p.z);
      section.maxZ = Math.max(section.maxZ, corner.p.z);
    }
  }
  const along: 'x' | 'z' = section.maxX - section.minX >= section.maxZ - section.minZ ? 'x' : 'z';
  const across: 'x' | 'z' = along === 'x' ? 'z' : 'x';
  const spans = mergeSpans(
    low
      .filter((triangle) => triangle.some((corner) => corner.p.y >= height))
      .map((triangle) => {
        const values = triangle.map((corner) => corner.p[along]);
        return [Math.min(...values), Math.max(...values)];
      }),
  );
  const acrossLow = (across === 'x' ? section.minX : section.minZ) - SECTION_SLACK;
  const acrossHigh = (across === 'x' ? section.maxX : section.maxZ) + SECTION_SLACK;

  const bays = openings.filter((opening) => opening.axis === along);
  const output: Face[] = [];
  for (const triangle of low) {
    // Dans une baie, le pied descend au seuil.
    let pieces: { polygon: Corner[]; limit: number }[] = [{ polygon: triangle, limit: height }];
    for (const bay of bays) {
      pieces = pieces.flatMap((piece) => {
        if (piece.limit !== height) return [piece];
        const inside = clipAlong(piece.polygon, along, bay.low, bay.high);
        return [
          ...outside(piece.polygon, along, bay.low, bay.high).map((polygon) => ({
            polygon,
            limit: height,
          })),
          ...(inside.length >= TRIANGLE ? [{ polygon: inside, limit: bay.sill }] : []),
        ];
      });
    }
    for (const piece of pieces) {
      if (piece.polygon.every((corner) => corner.p.y > piece.limit)) continue;
      for (const corners of fan(piece.polygon)) {
        output.push({ kind: 'low', corners, limit: piece.limit });
      }
    }
  }
  for (const triangle of caps) {
    const mean = triangle.reduce((sum, corner) => sum + corner.p.y, 0) / TRIANGLE;
    const inSection = clipAlong(triangle, across, acrossLow, acrossHigh);
    for (const [from, to] of spans) {
      let parts = [clipAlong(inSection, along, from - SECTION_SLACK, to + SECTION_SLACK)];
      for (const bay of bays) {
        parts = parts.flatMap((part) => outside(part, along, bay.low, bay.high));
      }
      for (const part of parts) {
        for (const corners of fan(part)) {
          output.push({ kind: 'cap', corners, mean });
        }
      }
    }
  }
  // Seuil et jambages de chaque baie, de la teinte du dessus du mur.
  const sample = caps[0]?.[0] ?? low[0]?.[0];
  const acrossMin = across === 'x' ? section.minX : section.minZ;
  const acrossMax = across === 'x' ? section.maxX : section.maxZ;
  const point = (alongValue: number, acrossValue: number, y: number): Corner => {
    const p = new Vector3(0, y, 0);
    p[along] = alongValue;
    p[across] = acrossValue;
    return { p, values: sample?.values.map((value) => [...value]) ?? [] };
  };
  const quad = (corners: Corner[], normal: Vector3): void => {
    for (const triangle of fan(corners)) {
      const [a, b, c] = triangle;
      if (a === undefined || b === undefined || c === undefined) continue;
      const facing = edgeA.subVectors(b.p, a.p).cross(edgeB.subVectors(c.p, a.p)).dot(normal);
      output.push({ kind: 'flat', corners: facing >= 0 ? [a, b, c] : [a, c, b], normal });
    }
  };
  for (const bay of sample === undefined ? [] : bays) {
    const up = new Vector3(0, 1, 0);
    quad(
      [
        point(bay.low, acrossMin, bay.sill),
        point(bay.high, acrossMin, bay.sill),
        point(bay.high, acrossMax, bay.sill),
        point(bay.low, acrossMax, bay.sill),
      ],
      up,
    );
    for (const [at, sign] of [
      [bay.low, 1],
      [bay.high, -1],
    ] as const) {
      const normal = new Vector3();
      normal[along] = sign;
      quad(
        [
          point(at, acrossMin, bay.sill),
          point(at, acrossMax, bay.sill),
          point(at, acrossMax, height),
          point(at, acrossMin, height),
        ],
        normal,
      );
    }
  }

  const vertexCount = output.length * TRIANGLE;
  const positions = new Float32Array(vertexCount * TRIANGLE);
  const values = attributes.map((attribute) => new Float32Array(vertexCount * attribute.itemSize));
  const normalIndex = names.indexOf('normal');
  const local = new Vector3();
  let v = 0;
  const flatNormal = new Vector3();
  for (const face of output) {
    // Les faces les plus hautes à l'origine passent au-dessus des autres faces écrasées.
    const capY = face.kind === 'cap' ? height + (top > 0 ? (CAP_SPREAD * face.mean) / top : 0) : 0;
    if (face.kind === 'flat') flatNormal.copy(face.normal).transformDirection(fromModel);
    else if (face.kind === 'cap') flatNormal.copy(upLocal);
    for (const corner of face.corners) {
      const y =
        face.kind === 'cap'
          ? capY
          : face.kind === 'low'
            ? Math.min(corner.p.y, face.limit)
            : corner.p.y;
      local.set(corner.p.x, y, corner.p.z).applyMatrix4(fromModel);
      positions[v * TRIANGLE] = local.x;
      positions[v * TRIANGLE + 1] = local.y;
      positions[v * TRIANGLE + 2] = local.z;
      attributes.forEach((attribute, i) => {
        const size = attribute.itemSize;
        const target = values[i];
        if (target === undefined) return;
        for (let j = 0; j < size; j += 1) {
          target[v * size + j] =
            face.kind !== 'low' && i === normalIndex
              ? flatNormal.getComponent(j)
              : (corner.values[i]?.[j] ?? 0);
        }
      });
      v += 1;
    }
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new Float32BufferAttribute(positions, TRIANGLE));
  names.forEach((name, i) => {
    const target = values[i];
    const attribute = attributes[i];
    if (target !== undefined && attribute !== undefined) {
      out.setAttribute(name, new Float32BufferAttribute(target, attribute.itemSize));
    }
  });
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

/** Matrice d'un objet vers l'un de ses ancêtres (matrices locales, à jour). */
export function matrixToAncestor(object: Object3D, ancestor: Object3D, out: Matrix4): Matrix4 {
  out.identity();
  let current: Object3D | null = object;
  while (current !== null && current !== ancestor) {
    current.updateMatrix();
    out.premultiply(current.matrix);
    current = current.parent;
  }
  return out;
}
