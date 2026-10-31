/**
 * Lots instanciés par nom de modèle: chaque modèle (toutes ses pièces
 * fusionnées) devient un maillage instancié, rempli à chaque image avec les
 * matrices voulues. Sert au potager, aux arbres à couper et aux objets au sol.
 */
import { Group, Matrix4, type InstancedMesh } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bakeGeometry } from './decor';
import { emptyGeometry } from './geometrie';
import { createInstanced, finishInstances } from './instances';
import type { SharedMaterials } from './materiaux';
import type { ModelLibrary } from './modeles';
import type { ResourceTracker } from './ressources';
import type { SubstituteHints } from './substituts';

export class InstancedBatches {
  readonly group = new Group();
  private readonly batches = new Map<string, InstancedMesh>();

  constructor(
    name: string,
    private readonly library: ModelLibrary,
    private readonly materials: SharedMaterials,
    private readonly resources: ResourceTracker,
    private readonly capacity: number,
    private readonly shadows = true,
  ) {
    this.group.name = name;
  }

  private batch(model: string, hints: SubstituteHints): InstancedMesh {
    let mesh = this.batches.get(model);
    if (mesh !== undefined) {
      return mesh;
    }
    const identity = new Matrix4();
    const parts = this.library.parts(model, hints).map((part) => bakeGeometry(part.geometry, identity.copy(part.matrix)));
    const merged = parts.length === 0 ? null : parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
    for (const part of parts) {
      if (part !== merged) {
        part.dispose();
      }
    }
    mesh = createInstanced(model, this.resources.track(merged ?? emptyGeometry()), this.materials.palette, this.capacity);
    mesh.castShadow = this.shadows;
    this.group.add(mesh);
    this.batches.set(model, mesh);
    return mesh;
  }

  /** Vide tous les lots avant de les remplir pour cette image. */
  begin(): void {
    for (const mesh of this.batches.values()) {
      mesh.count = 0;
    }
  }

  /** Ajoute une instance du modèle. */
  add(model: string, matrix: Matrix4, hints: SubstituteHints = {}): void {
    const mesh = this.batch(model, hints);
    if (mesh.count >= mesh.instanceMatrix.count) {
      return;
    }
    mesh.setMatrixAt(mesh.count, matrix);
    mesh.count += 1;
  }

  /** Termine l'image: met à jour les tampons et les sphères englobantes. */
  end(): void {
    for (const mesh of this.batches.values()) {
      finishInstances(mesh);
    }
  }
}
