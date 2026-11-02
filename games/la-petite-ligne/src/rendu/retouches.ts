/**
 * Retouches de modèles de l'artiste au chargement, en attendant leur réexport: on retire les
 * triangles d'une pièce qui n'a pas de raison d'être (règle « Cohérence du monde »).
 *
 * Ponton (retour R21 du 2026-11-01): son escalier descendait dans l'eau sans barque ni
 * débarcadère, et il occupait les deux places assises du bout du ponton (étoiles de l'Aubrune,
 * jambes au-dessus de l'eau). On le retire; le platelage, les pieux, la corde et le pieu
 * d'amarrage (perchoir du martin-pêcheur) restent.
 */
import { Vector3, type BufferAttribute, type BufferGeometry } from 'three';

export interface ModelTrim {
  /** Nom du maillage dans le GLB. */
  readonly node: string;
  /** Boîte (repère du maillage, glTF: y vers le haut): un triangle dont le centre y tombe est retiré. */
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

const TRIANGLE = 3;

/** Copie de la géométrie sans les triangles dont le centre tombe dans la boîte; la même si rien n'y tombe. */
export function trimGeometry(geometry: BufferGeometry, trim: ModelTrim): BufferGeometry {
  const position = geometry.getAttribute('position') as BufferAttribute | undefined;
  if (position === undefined) return geometry;
  const index = geometry.index;
  const count = index === null ? position.count : index.count;
  const vertex = (i: number): number => (index === null ? i : index.getX(i));
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const kept: number[] = [];
  let removed = 0;
  for (let t = 0; t + 2 < count; t += TRIANGLE) {
    a.fromBufferAttribute(position, vertex(t));
    b.fromBufferAttribute(position, vertex(t + 1));
    c.fromBufferAttribute(position, vertex(t + 2));
    a.add(b).add(c).divideScalar(TRIANGLE);
    const inside =
      a.x >= trim.min[0] &&
      a.x <= trim.max[0] &&
      a.y >= trim.min[1] &&
      a.y <= trim.max[1] &&
      a.z >= trim.min[2] &&
      a.z <= trim.max[2];
    if (inside) {
      removed += 1;
      continue;
    }
    kept.push(vertex(t), vertex(t + 1), vertex(t + 2));
  }
  if (removed === 0) return geometry;
  const out = geometry.clone();
  out.setIndex(kept);
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}
