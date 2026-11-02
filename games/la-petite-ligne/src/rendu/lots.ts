/**
 * Lots instanciés par nom de modèle: chaque modèle (toutes ses pièces
 * fusionnées) devient un maillage instancié, rempli à chaque image avec les
 * matrices voulues. Sert au potager, aux arbres à couper et aux objets au sol.
 */
import { Group, Matrix4, type BufferGeometry, type InstancedMesh } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bakeGeometry } from './decor';
import { emptyGeometry } from './geometrie';
import { createInstanced, finishInstances } from './instances';
import type { SharedMaterials } from './materiaux';
import type { ModelLibrary } from './modeles';
import type { ResourceTracker } from './ressources';
import type { SubstituteHints } from './substituts';

/** Clé numérique d'un morceau: colonne et rangée décalées (positives), puis combinées. */
const CHUNK_BIAS = 512;
const CHUNK_STRIDE = 4096;

export class InstancedBatches {
  readonly group = new Group();
  /** Tous les lots, et ceux de chaque modèle par morceau (clé numérique: rien d'alloué par image). */
  private readonly batches: InstancedMesh[] = [];
  private readonly byModel = new Map<string, Map<number, InstancedMesh>>();
  private readonly geometries = new Map<string, BufferGeometry>();

  /**
   * `chunkSize` (m, 0: aucun): un lot par modèle et par morceau de la carte, pour que ceux hors du
   * cadre soient éliminés (arbres de la lisière, ADR 0016). `capacity` vaut alors par morceau.
   */
  constructor(
    name: string,
    private readonly library: ModelLibrary,
    private readonly materials: SharedMaterials,
    private readonly resources: ResourceTracker,
    private readonly capacity: number,
    private readonly shadows = true,
    private readonly chunkSize = 0,
  ) {
    this.group.name = name;
  }

  private batch(model: string, hints: SubstituteHints, matrix: Matrix4): InstancedMesh {
    const key =
      this.chunkSize > 0
        ? (Math.floor(matrix.elements[12] / this.chunkSize) + CHUNK_BIAS) * CHUNK_STRIDE +
          Math.floor(matrix.elements[14] / this.chunkSize) +
          CHUNK_BIAS
        : 0;
    let chunks = this.byModel.get(model);
    if (chunks === undefined) {
      chunks = new Map();
      this.byModel.set(model, chunks);
    }
    let mesh = chunks.get(key);
    if (mesh !== undefined) {
      return mesh;
    }
    const name = this.chunkSize > 0 ? `${model} ${String(key)}` : model;
    mesh = createInstanced(name, this.geometry(model, hints), this.materials.palette, this.capacity);
    mesh.castShadow = this.shadows;
    this.group.add(mesh);
    chunks.set(key, mesh);
    this.batches.push(mesh);
    return mesh;
  }

  private geometry(model: string, hints: SubstituteHints): BufferGeometry {
    const known = this.geometries.get(model);
    if (known !== undefined) {
      return known;
    }
    const identity = new Matrix4();
    const parts = this.library
      .parts(model, hints)
      .map((part) => bakeGeometry(part.geometry, identity.copy(part.matrix)));
    const merged =
      parts.length === 0 ? null : parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
    for (const part of parts) {
      if (part !== merged) {
        part.dispose();
      }
    }
    const geometry = this.resources.track(merged ?? emptyGeometry());
    this.geometries.set(model, geometry);
    return geometry;
  }

  /** Vide tous les lots avant de les remplir pour cette image. */
  begin(): void {
    for (const mesh of this.batches) {
      mesh.count = 0;
    }
  }

  /** Ajoute une instance du modèle. */
  add(model: string, matrix: Matrix4, hints: SubstituteHints = {}): void {
    const mesh = this.batch(model, hints, matrix);
    if (mesh.count >= mesh.instanceMatrix.count) {
      return;
    }
    mesh.setMatrixAt(mesh.count, matrix);
    mesh.count += 1;
  }

  /** Termine l'image: met à jour les tampons et les sphères englobantes. */
  end(): void {
    for (const mesh of this.batches) {
      finishInstances(mesh);
    }
  }
}
