/**
 * Maillages instanciés du rendu. Ils portent tous une couleur par instance
 * (blanche par défaut), pour partager un seul programme de shader entre les
 * cultures, les touffes, les arbres, les poules et les particules.
 */
import { Color, InstancedMesh, Matrix4, type BufferGeometry, type Material } from 'three';

const WHITE = new Color(1, 1, 1);
const HIDDEN = new Matrix4().makeScale(0, 0, 0);

export function createInstanced(
  name: string,
  geometry: BufferGeometry,
  material: Material,
  capacity: number,
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, Math.max(1, capacity));
  mesh.name = name;
  for (let i = 0; i < mesh.count; i += 1) {
    mesh.setMatrixAt(i, HIDDEN);
    mesh.setColorAt(i, WHITE);
  }
  mesh.count = 0;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Recalcule la sphère englobante après un changement des instances (élimination hors champ juste). */
export function finishInstances(mesh: InstancedMesh): void {
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor !== null) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();
  mesh.visible = mesh.count > 0;
}
