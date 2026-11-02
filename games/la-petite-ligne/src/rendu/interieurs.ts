/**
 * Bâtiments visitables (tour 10, ADR 0016): les intérieurs sont sur la carte, à leur place. Chez le
 * joueur local qui est dedans, le toit, l'étage et les murs tournés vers la caméra s'effacent (on
 * garde leur pied, `coupe-murs.ts`), et le contenu fixe de l'intérieur paraît; chez l'autre, le
 * bâtiment reste entier, contenu masqué (ni triangle, ni appel, ni ombre). Tant que rien n'est
 * coupé ni ouvert, les pièces fixes d'un bâtiment sont fusionnées (un appel par matériau).
 *
 * La lampe de la maisonnette est la seule lampe des intérieurs: elle se déplace dans le bâtiment où
 * est le joueur local (aucune `PointLight` de plus, sinon tous les programmes se recompilent).
 *
 * `StagedBuilding` (maisonnette et poulailler: ruine, réparé, éléments à bâtir) vient de `maison.ts`.
 */
import {
  Box3,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  SkinnedMesh,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
  type PointLight,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { BuildingId, GameMap, MapBuilding, MapProp } from '../etat/carte';
import { HOUSE_BUILDING } from '../etat/carte';
import type { ConstructionState, DeepReadonly } from '../etat/types';
import { yawFromQuarter, type FrameContext } from './contexte';
import { lowWallGeometry, matrixToAncestor, type WallOpening } from './coupe-murs';
import { bakeGeometry, propHints, propMatrix } from './decor';
import type { SharedMaterials } from './materiaux';
import type { ModelLibrary } from './modeles';
import type { EventfulPart } from './monde';
import { applyShadows } from './ombre-tri';
import { RENDER_SETTINGS } from './reglages';
import type { ResourceTracker } from './ressources';

export const GHOST_TINT = '#fff1cf';
export const GHOST_BASE_OPACITY = 0.22;
export const GHOST_PROGRESS_OPACITY = 0.5;
export const GHOST_PULSE = 0.08;
/** Seuil du produit scalaire: un mur qui regarde la caméra au-delà est coupé. */
export const WALL_FACES_CAMERA = 0.25;

/** Une pièce de bâtiment: mur ou toit (coupés quand on est dedans), ou élément à construire. */
interface BuildPart {
  node: Object3D;
  /** Appartient à la ruine ou au modèle réparé. */
  owner: 'ruin' | 'repaired';
  /** Direction (au sol, repère du modèle) vers laquelle regarde un mur; `null` pour le reste. */
  facing: Vector3 | null;
  roof: boolean;
}

interface ElementPart {
  construction: string;
  element: string;
  node: Object3D;
  ghost: Mesh[];
  material: MeshBasicMaterial;
  roof: boolean;
  facing: Vector3 | null;
}

/**
 * Pièces fixes d'un modèle (murs, gravats, sol) fusionnées en un maillage par
 * matériau et par réglage d'ombre: dessinées d'un seul appel tant qu'elles
 * sont toutes visibles; dès que l'une est coupée (personnage dedans), on
 * revient aux pièces séparées. Les éléments à construire et les toits qui
 * s'effacent pendant le chantier restent à part.
 */
interface FixedMerge {
  model: Object3D;
  /** Enfants directs du modèle couverts par la fusion. */
  pieces: Object3D[];
  meshes: Mesh[];
}

/** Fusionne les maillages sous `pieces` (repère du modèle), ou `null` si leurs attributs diffèrent. */
export function mergePieces(
  model: Object3D,
  pieces: readonly Object3D[],
  resources: ResourceTracker,
): Mesh[] | null {
  model.updateMatrixWorld(true);
  const toModel = new Matrix4().copy(model.matrixWorld).invert();
  const local = new Matrix4();
  const buckets = new Map<
    string,
    { material: Material; cast: boolean; receive: boolean; geometries: BufferGeometry[] }
  >();
  let invalid = false;
  for (const piece of pieces) {
    piece.traverse((object) => {
      if (!(object instanceof Mesh) || object instanceof InstancedMesh || invalid) {
        return;
      }
      if (Array.isArray(object.material) || object instanceof SkinnedMesh) {
        invalid = true;
        return;
      }
      const material = object.material as Material;
      const key = `${material.uuid}|${String(object.castShadow)}|${String(object.receiveShadow)}`;
      let bucket = buckets.get(key);
      if (bucket === undefined) {
        bucket = {
          material,
          cast: object.castShadow,
          receive: object.receiveShadow,
          geometries: [],
        };
        buckets.set(key, bucket);
      }
      local.multiplyMatrices(toModel, object.matrixWorld);
      bucket.geometries.push(bakeGeometry(object.geometry as BufferGeometry, local));
    });
  }
  const meshes: Mesh[] = [];
  for (const bucket of buckets.values()) {
    const merged = invalid ? null : mergeGeometries(bucket.geometries, false);
    for (const geometry of bucket.geometries) {
      geometry.dispose();
    }
    if (merged === null) {
      invalid = true;
      continue;
    }
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    const mesh = new Mesh(resources.track(merged), bucket.material);
    mesh.name = `${model.name} (pièces fixes)`;
    mesh.castShadow = bucket.cast;
    mesh.receiveShadow = bucket.receive;
    mesh.visible = false;
    meshes.push(mesh);
  }
  if (invalid) {
    for (const mesh of meshes) {
      mesh.geometry.dispose();
    }
    return null;
  }
  return meshes;
}

export interface StagedState {
  repaired: boolean;
  /** La construction a commencé: les restes du vieux toit laissent place aux fantômes. */
  hideRuinRoof: boolean;
  constructions: readonly DeepReadonly<ConstructionState>[];
  time: number;
  cut: boolean;
  toCamera: Vector3;
}

export function ghostCopies(source: Object3D, material: Material): Mesh[] {
  const copies: Mesh[] = [];
  source.updateMatrixWorld(true);
  source.traverse((object) => {
    if (object instanceof Mesh) {
      const ghost = new Mesh(object.geometry as BufferGeometry, material);
      ghost.matrixAutoUpdate = false;
      ghost.matrix.copy(object.matrixWorld);
      ghost.renderOrder = 2;
      copies.push(ghost);
    }
  });
  return copies;
}

/** Bâtiment à deux états (ruine, réparé) et à éléments construits un par un. */
export class StagedBuilding {
  readonly group = new Group();
  readonly ruin: Object3D;
  readonly repaired: Object3D;
  private readonly elements: ElementPart[] = [];
  private readonly parts: BuildPart[] = [];
  private readonly fixed: Object3D[] = [];
  private readonly merges: FixedMerge[] = [];
  /** Pied de chaque mur, montré quand le mur est coupé (R12). */
  private readonly stubs: { part: BuildPart; stub: Object3D }[] = [];
  private readonly centre = new Vector3();
  private readonly worldFacing = new Vector3();
  /** Fusions des pièces visibles du modèle réparé (faites au premier besoin, refaites après `swapPiece`). */
  private complete: VisibleMerges | null = null;

  constructor(
    prop: MapProp,
    ground: number,
    library: ModelLibrary,
    private readonly resources: ResourceTracker,
    private readonly materials: SharedMaterials,
    names: { ruin: string; repaired: string },
    host: Group,
  ) {
    this.group.name = prop.model;
    propMatrix(prop, ground, this.group.matrix);
    this.group.matrix.decompose(this.group.position, this.group.quaternion, this.group.scale);
    this.ruin = library.instantiate(
      library.has(names.ruin) ? names.ruin : prop.model,
      propHints(prop),
    );
    this.repaired = library.has(names.repaired)
      ? library.instantiate(names.repaired, propHints(prop))
      : this.ruin;
    for (const model of new Set([this.ruin, this.repaired])) {
      applyShadows(model);
      this.group.add(model);
    }
    host.add(this.group);
    this.group.updateMatrixWorld(true);
    new Box3().setFromObject(this.repaired).getCenter(this.centre);
  }

  /** Associe un élément de construction à un nœud du modèle réparé (un élément peut en montrer plusieurs). */
  bindElement(construction: string, element: string, nodeName: string, roof: boolean): void {
    const node = this.repaired.getObjectByName(nodeName);
    if (node === undefined || this.repaired === this.ruin) {
      return;
    }
    const material = this.resources.track(
      new MeshBasicMaterial({
        map: this.materials.paletteTexture,
        color: new Color(GHOST_TINT),
        transparent: true,
        opacity: GHOST_BASE_OPACITY,
        depthWrite: false,
      }),
    );
    const ghost = ghostCopies(node, material);
    for (const mesh of ghost) {
      this.group.parent?.add(mesh);
    }
    this.elements.push({ construction, element, node, ghost, material, roof, facing: null });
  }

  /** Après les liaisons: repère les murs et le toit (coupe) et les pièces fixes du modèle réparé. */
  finish(roofPattern: RegExp, wallPattern: RegExp): void {
    const box = new Box3();
    const centre = new Vector3();
    const origin = new Vector3();
    this.group.getWorldPosition(origin);
    const inverse = this.group.quaternion.clone().invert();
    const elementNodes = new Set(this.elements.map((element) => element.node));
    const facingOf = (object: Object3D): Vector3 => {
      box.setFromObject(object).getCenter(centre).sub(origin).applyQuaternion(inverse);
      return Math.abs(centre.x) > Math.abs(centre.z)
        ? new Vector3(Math.sign(centre.x), 0, 0)
        : new Vector3(0, 0, Math.sign(centre.z));
    };
    for (const element of this.elements) {
      element.facing = element.roof ? null : facingOf(element.node);
    }
    const containsElement = (object: Object3D): boolean => {
      let found = false;
      object.traverse((child) => {
        found ||= elementNodes.has(child);
      });
      return found;
    };
    for (const [owner, model] of [
      ['ruin', this.ruin],
      ['repaired', this.repaired],
    ] as const) {
      if (owner === 'repaired' && model === this.ruin) {
        continue;
      }
      for (const child of model.children) {
        if (owner === 'repaired' && !containsElement(child)) {
          this.fixed.push(child);
        }
        if (roofPattern.test(child.name)) {
          this.parts.push({ node: child, owner, facing: null, roof: true });
        } else if (wallPattern.test(child.name)) {
          this.parts.push({ node: child, owner, facing: facingOf(child), roof: false });
        }
      }
      const pieces = model.children.filter(
        (child) => !roofPattern.test(child.name) && !containsElement(child),
      );
      const meshes = pieces.length > 1 ? mergePieces(model, pieces, this.resources) : null;
      if (meshes !== null) {
        for (const mesh of meshes) {
          model.add(mesh);
        }
        this.merges.push({ model, pieces, meshes });
      }
    }
    // Après la fusion: les pieds de mur restent hors des pièces fusionnées. Les portes des
    // murs (éléments non toits) y deviennent des baies: les murs de l'artiste sont pleins.
    const doors = this.elements
      .filter((element) => !element.roof && element.facing !== null)
      .map((element) => ({ facing: element.facing, box: this.boxInModel(element.node) }));
    for (const part of this.parts) {
      if (part.roof || part.facing === null) continue;
      const model = part.owner === 'ruin' ? this.ruin : this.repaired;
      const facing = part.facing;
      const openings: WallOpening[] = doors
        .filter((door) => door.facing?.equals(facing) === true && !door.box.isEmpty())
        .map((door) => {
          const axis = facing.x !== 0 ? 'z' : 'x';
          return {
            axis,
            low: door.box.min[axis],
            high: door.box.max[axis],
            sill: RENDER_SETTINGS.house.doorSillHeight,
          };
        });
      const stub = this.wallStub(part.node, model, openings);
      if (stub !== null) {
        model.add(stub);
        this.stubs.push({ part, stub });
      }
    }
  }

  /** Boîte d'un nœud du modèle réparé, dans le repère du modèle (matrices locales). */
  private boxInModel(node: Object3D): Box3 {
    const box = new Box3();
    const matrix = new Matrix4();
    node.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const geometry = object.geometry as BufferGeometry;
      geometry.computeBoundingBox();
      if (geometry.boundingBox === null) return;
      matrixToAncestor(object, this.repaired, matrix);
      box.union(geometry.boundingBox.clone().applyMatrix4(matrix));
    });
    return box;
  }

  /** Pied d'un mur (`coupe-murs.ts`), dans le repère du modèle; `null` s'il n'a rien de bas. */
  private wallStub(
    wall: Object3D,
    model: Object3D,
    openings: readonly WallOpening[],
  ): Object3D | null {
    const group = new Group();
    group.name = `${wall.name}_pied`;
    const toModel = new Matrix4();
    wall.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      matrixToAncestor(object, model, toModel);
      const geometry = lowWallGeometry(
        object.geometry as BufferGeometry,
        toModel,
        RENDER_SETTINGS.house.cutWallHeight,
        openings,
      );
      if (geometry === null) return;
      const mesh = new Mesh(this.resources.track(geometry), object.material);
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(toModel);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    });
    group.visible = false;
    return group.children.length > 0 ? group : null;
  }

  center(): Vector3 {
    return this.centre;
  }

  /**
   * Remplace une fois pour toutes une pièce fixe du modèle réparé (un mur plein) par une autre
   * (tour 10: le mur à porte percée quand le cellier ou la chambre est bâti). La fusion des pièces
   * fixes et le pied du mur sont refaits; la nouvelle pièce est vraiment percée, son pied aussi.
   * Rend faux si la pièce n'existe pas (déjà remplacée, modèle sans états).
   */
  swapPiece(oldName: string, replacement: Object3D): boolean {
    const old = this.repaired.children.find((child) => child.name === oldName);
    if (old === undefined || this.repaired === this.ruin) {
      return false;
    }
    applyShadows(replacement);
    this.repaired.add(replacement);
    old.removeFromParent();
    const fixedIndex = this.fixed.indexOf(old);
    if (fixedIndex >= 0) this.fixed[fixedIndex] = replacement;
    for (const part of this.parts) {
      if (part.node === old) part.node = replacement;
    }
    for (let i = this.stubs.length - 1; i >= 0; i -= 1) {
      const entry = this.stubs[i];
      if (entry?.part.node === replacement) {
        entry.stub.removeFromParent();
        this.stubs.splice(i, 1);
      }
    }
    const part = this.parts.find((candidate) => candidate.node === replacement);
    if (part !== undefined && part.facing !== null) {
      const stub = this.wallStub(replacement, this.repaired, []);
      if (stub !== null) {
        this.repaired.add(stub);
        this.stubs.push({ part, stub });
      }
    }
    if (this.complete !== null) {
      this.complete.dispose();
      this.complete = null;
    }
    const merge = this.merges.find((candidate) => candidate.model === this.repaired);
    if (merge !== undefined) {
      for (const mesh of merge.meshes) {
        mesh.removeFromParent();
        mesh.geometry.dispose();
      }
      merge.pieces = merge.pieces.map((piece) => (piece === old ? replacement : piece));
      const meshes = mergePieces(this.repaired, merge.pieces, this.resources);
      if (meshes === null) {
        // Plus de fusion possible: les pièces restent séparées (jamais rien de caché pour rien).
        this.merges.splice(this.merges.indexOf(merge), 1);
      } else {
        merge.meshes = meshes;
        for (const mesh of meshes) this.repaired.add(mesh);
      }
    }
    return true;
  }

  elementCenter(element: string, out: Vector3): Vector3 {
    const part = this.elements.find((candidate) => candidate.element === element);
    if (part === undefined) {
      return out.copy(this.centre);
    }
    return new Box3().setFromObject(part.node).getCenter(out);
  }

  private cutAway(part: { roof: boolean; facing: Vector3 | null }, state: StagedState): boolean {
    if (!state.cut) {
      return false;
    }
    if (part.roof) {
      return true;
    }
    if (part.facing === null) {
      return false;
    }
    this.worldFacing.copy(part.facing).applyQuaternion(this.group.quaternion);
    return this.worldFacing.dot(state.toCamera) > WALL_FACES_CAMERA;
  }

  apply(state: StagedState): void {
    // Pièces fixes visibles par défaut; la fusion ne reprend la main qu'à la fin, si rien n'est coupé.
    for (const merge of this.merges) {
      for (const piece of merge.pieces) {
        piece.visible = true;
      }
    }
    this.applyParts(state);
    for (const merge of this.merges) {
      let whole = true;
      for (const piece of merge.pieces) {
        whole &&= piece.visible;
      }
      if (whole) {
        for (const piece of merge.pieces) {
          piece.visible = false;
        }
      }
      for (const mesh of merge.meshes) {
        mesh.visible = whole;
      }
    }
    this.applyComplete();
  }

  /**
   * Après la logique de visibilité: les pièces visibles du modèle réparé (éléments bâtis, murs
   * restants et pieds de mur quand on est dedans) fusionnées par jeu de visibilité (`VisibleMerges`):
   * un chantier en cours, une maison finie ou ouverte coûtent un appel par matériau.
   */
  private applyComplete(): void {
    if (this.repaired === this.ruin) {
      return;
    }
    if (this.complete === null) {
      const own = new Set<Object3D>();
      for (const merge of this.merges) for (const mesh of merge.meshes) own.add(mesh);
      const pieces = this.repaired.children.filter((child) => !own.has(child));
      this.complete = new VisibleMerges(this.repaired, pieces, this.resources);
    }
    this.complete.apply();
  }

  private applyParts(state: StagedState): void {
    const separate = this.repaired !== this.ruin;
    this.ruin.visible = !separate || !state.repaired;
    for (const node of this.fixed) {
      node.visible = state.repaired;
    }
    for (const part of this.parts) {
      const base =
        part.owner === 'ruin' ? !(part.roof && state.hideRuinRoof && separate) : state.repaired;
      part.node.visible = base && !this.cutAway(part, state);
    }
    for (const { part, stub } of this.stubs) {
      const base = part.owner === 'ruin' ? true : state.repaired;
      stub.visible = base && this.cutAway(part, state);
    }
    const pulse =
      Math.sin(state.time * Math.PI * 2 * RENDER_SETTINGS.effects.highlightPulseHz) * GHOST_PULSE;
    for (const part of this.elements) {
      const construction = state.constructions.find(
        (candidate) => candidate.id === part.construction,
      );
      const element = construction?.elements.find((candidate) => candidate.id === part.element);
      const status = construction?.status ?? 'locked';
      const solid = status === 'done' || element?.done === true;
      const ghost = status === 'ghost' && !solid;
      const hidden = this.cutAway(part, state);
      part.node.visible = solid && !hidden;
      for (const mesh of part.ghost) {
        mesh.visible = ghost && !hidden;
      }
      if (ghost) {
        part.material.opacity =
          GHOST_BASE_OPACITY + GHOST_PROGRESS_OPACITY * (element?.progress ?? 0) + pulse;
      }
    }
  }

  dispose(): void {
    for (const part of this.elements) {
      for (const mesh of part.ghost) {
        mesh.removeFromParent();
      }
    }
    this.group.removeFromParent();
  }
}


/**
 * Fusions des pièces visibles d'un modèle coupé, une par jeu de pièces visibles (au plus une par
 * orientation de la caméra), faites au premier besoin: un bâtiment ouvert coûte un appel par
 * matériau au lieu d'un par pièce. Clé: masque des pièces candidates (aucune allocation par image).
 */
class VisibleMerges {
  private readonly cache = new Map<number, Mesh[]>();
  private shown: Mesh[] | null = null;

  constructor(
    private readonly model: Object3D,
    private readonly candidates: readonly Object3D[],
    private readonly resources: ResourceTracker,
  ) {}

  /** Après la logique de visibilité: remplace les pièces visibles par leur fusion. */
  apply(): void {
    let key = 0;
    let count = 0;
    for (let i = 0; i < this.candidates.length && i < MAX_MERGE_BITS; i += 1) {
      if (this.candidates[i]?.visible === true) {
        key |= 1 << i;
        count += 1;
      }
    }
    let meshes = this.cache.get(key);
    if (meshes === undefined && count > 1) {
      const visible = this.candidates.filter((piece, i) => i < MAX_MERGE_BITS && piece.visible);
      meshes = mergePieces(this.model, visible, this.resources) ?? [];
      for (const mesh of meshes) this.model.add(mesh);
      this.cache.set(key, meshes);
    }
    if (this.shown !== meshes && this.shown !== null) for (const mesh of this.shown) mesh.visible = false;
    this.shown = meshes ?? null;
    if (meshes === undefined || meshes.length === 0) return;
    for (let i = 0; i < this.candidates.length && i < MAX_MERGE_BITS; i += 1) {
      const piece = this.candidates[i];
      if (piece !== undefined && (key & (1 << i)) !== 0) piece.visible = false;
    }
    for (const mesh of meshes) mesh.visible = true;
  }

  /** Rien de fusionné à cette image (bâtiment entier ou en chantier). */
  hide(): void {
    if (this.shown !== null) for (const mesh of this.shown) mesh.visible = false;
    this.shown = null;
  }

  /** Retire et libère toutes les fusions (les pièces ont changé). */
  dispose(): void {
    for (const meshes of this.cache.values()) {
      for (const mesh of meshes) {
        mesh.removeFromParent();
        mesh.geometry.dispose();
      }
    }
    this.cache.clear();
    this.shown = null;
  }
}

/** Pièces candidates d'une fusion de coupe au plus (bits d'un entier). */
const MAX_MERGE_BITS = 30;

/** Un mur coupé quand il regarde la caméra (joueur local dedans), et son pied (R12). */
interface CutWall {
  node: Object3D;
  /** Direction vers laquelle il regarde, au sol, repère du modèle. */
  facing: Vector3;
  stub: Object3D | null;
}

/** Vantail d'une porte: pivot sur le jambage gauche vu de dehors, il s'ouvre vers l'intérieur. */
interface DoorLeaf {
  node: Object3D;
  rest: Quaternion;
  /** Ouverture de 0 (fermée) à 1, et sa dernière valeur appliquée. */
  open: number;
  shown: number;
  /** Milieu du vantail fermé (monde, au sol). */
  centre: Vector3;
}

const DEGREES = Math.PI / 180;

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/**
 * Bâtiment visitable à coupe (épicerie d'Odette, mercerie de Solange): murs du rez-de-chaussée
 * (`<id>_wall_*`), nœuds retirés en entier (`cut_nodes`: toit, étage, comble), contenu fixe
 * (`<id>_interior`) et vantaux (`<id>_door`, `<id>_back_door`). Le sol n'est jamais coupé.
 */
export class OpenableBuilding {
  readonly group = new Group();
  readonly model: Object3D;
  private readonly walls: CutWall[] = [];
  private readonly cutNodes = new Set<Object3D>();
  private readonly content: Object3D[] = [];
  private readonly doors: DoorLeaf[] = [];
  /** Pièces fixes (sauf contenu et vantaux), pour la fusion et la coupe. */
  private readonly pieces: Object3D[] = [];
  private readonly merged: Mesh[];
  private readonly opened: VisibleMerges;
  private readonly worldFacing = new Vector3();
  private readonly turn = new Quaternion();
  private readonly up = new Vector3(0, 1, 0);
  /** Centre de la pièce principale (monde, au sol): là où va la lampe. */
  readonly roomCentre = new Vector3();

  constructor(
    readonly building: DeepReadonly<MapBuilding>,
    prop: MapProp,
    library: ModelLibrary,
    resources: ResourceTracker,
    host: Group,
  ) {
    this.group.name = `interieur ${building.id}`;
    propMatrix(prop, 0, this.group.matrix);
    this.group.matrix.decompose(this.group.position, this.group.quaternion, this.group.scale);
    this.model = library.instantiate(prop.model, propHints(prop));
    applyShadows(this.model);
    this.group.add(this.model);
    host.add(this.group);
    this.group.updateMatrixWorld(true);
    const room = building.rooms[0]?.rect;
    if (room !== undefined) {
      this.roomCentre.set(room.x + room.w / 2, 0, room.y + room.h / 2);
    }
    const cutNames = new Set(isStringList(library.extras(prop.model).cut_nodes) ? (library.extras(prop.model).cut_nodes as string[]) : []);
    const origin = new Vector3();
    this.group.getWorldPosition(origin);
    const inverse = this.group.quaternion.clone().invert();
    const box = new Box3();
    const centre = new Vector3();
    const facingOf = (object: Object3D): Vector3 => {
      box.setFromObject(object).getCenter(centre).sub(origin).applyQuaternion(inverse);
      return Math.abs(centre.x) > Math.abs(centre.z)
        ? new Vector3(Math.sign(centre.x), 0, 0)
        : new Vector3(0, 0, Math.sign(centre.z));
    };
    const doorBoxes: { facing: Vector3; box: Box3 }[] = [];
    for (const child of [...this.model.children]) {
      const name = child.name;
      if (name.endsWith('_interior')) {
        this.content.push(child);
        continue;
      }
      if (name.endsWith('_door')) {
        const leafBox = this.boxInModel(child);
        doorBoxes.push({ facing: facingOf(child), box: leafBox });
        const middle = new Box3().setFromObject(child).getCenter(new Vector3());
        this.doors.push({ node: child, rest: child.quaternion.clone(), open: 0, shown: 0, centre: middle.setY(0) });
        continue;
      }
      this.pieces.push(child);
      if (cutNames.has(name)) {
        this.cutNodes.add(child);
      } else if (/_wall_(front|back|left|right)$/.test(name)) {
        this.walls.push({ node: child, facing: facingOf(child), stub: null });
      }
    }
    const settings = RENDER_SETTINGS.interiors;
    for (const wall of this.walls) {
      const axis = wall.facing.x !== 0 ? 'z' : 'x';
      const openings: WallOpening[] = doorBoxes
        .filter((door) => door.facing.equals(wall.facing) && !door.box.isEmpty())
        .map((door) => ({ axis, low: door.box.min[axis], high: door.box.max[axis], sill: settings.doorSillHeight }));
      wall.stub = wallStub(wall.node, this.model, openings, resources, settings.cutWallHeight);
      if (wall.stub !== null) this.model.add(wall.stub);
    }
    const all = [...this.pieces, ...this.doors.map((door) => door.node)];
    this.merged = (all.length > 1 ? mergePieces(this.model, all, resources) : null) ?? [];
    for (const mesh of this.merged) this.model.add(mesh);
    for (const node of this.content) node.visible = false;
    this.opened = new VisibleMerges(this.model, [...this.pieces, ...this.content], resources);
  }

  /** Boîte d'un nœud dans le repère du modèle (matrices locales). */
  private boxInModel(node: Object3D): Box3 {
    const out = new Box3();
    const matrix = new Matrix4();
    node.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const geometry = object.geometry as BufferGeometry;
      geometry.computeBoundingBox();
      if (geometry.boundingBox === null) return;
      matrixToAncestor(object, this.model, matrix);
      out.union(geometry.boundingBox.clone().applyMatrix4(matrix));
    });
    return out;
  }

  /** Vrai si le mur regarde la caméra (`toCamera`: au sol, repère du monde). */
  private faces(wall: CutWall, toCamera: Vector3): boolean {
    this.worldFacing.copy(wall.facing).applyQuaternion(this.group.quaternion);
    return this.worldFacing.dot(toCamera) > WALL_FACES_CAMERA;
  }

  /**
   * Une image: coupe si le joueur local est dedans; vantaux ouverts devant les personnages
   * (`near`: positions au sol des personnages dessinés, `count` premières valeurs).
   */
  apply(cut: boolean, toCamera: Vector3, dt: number, near: readonly Vector3[], count: number): void {
    const settings = RENDER_SETTINGS.interiors;
    let anyOpen = false;
    for (const door of this.doors) {
      let wanted = 0;
      for (let i = 0; i < count; i += 1) {
        const p = near[i];
        if (p !== undefined && Math.hypot(p.x - door.centre.x, p.z - door.centre.z) < settings.doorReach) {
          wanted = 1;
          break;
        }
      }
      const step = dt / Math.max(0.01, settings.doorSeconds);
      door.open = wanted > door.open ? Math.min(wanted, door.open + step) : Math.max(wanted, door.open - step);
      if (door.open !== door.shown) {
        door.shown = door.open;
        const t = door.open * door.open * (3 - 2 * door.open);
        this.turn.setFromAxisAngle(this.up, t * settings.doorOpenDeg * DEGREES);
        door.node.quaternion.copy(door.rest).multiply(this.turn);
      }
      anyOpen ||= door.open > 0;
    }
    const whole = !cut && !anyOpen;
    for (const mesh of this.merged) mesh.visible = whole;
    for (const door of this.doors) door.node.visible = !whole;
    for (const piece of this.pieces) {
      piece.visible = !whole && !(cut && this.cutNodes.has(piece));
    }
    for (const wall of this.walls) {
      const away = cut && this.faces(wall, toCamera);
      wall.node.visible = !whole && !away;
      if (wall.stub !== null) wall.stub.visible = away;
    }
    // Chaque image: l'échauffement des programmes (`warmUp`) rend un temps tout visible.
    for (const node of this.content) node.visible = cut;
    if (cut) this.opened.apply();
    else this.opened.hide();
  }

  dispose(): void {
    this.group.removeFromParent();
  }
}

/** Pied d'un mur (`coupe-murs.ts`), dans le repère du modèle; `null` s'il n'a rien de bas. */
export function wallStub(
  wall: Object3D,
  model: Object3D,
  openings: readonly WallOpening[],
  resources: ResourceTracker,
  height: number,
): Object3D | null {
  const group = new Group();
  group.name = `${wall.name}_pied`;
  const toModel = new Matrix4();
  wall.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    matrixToAncestor(object, model, toModel);
    const geometry = lowWallGeometry(object.geometry as BufferGeometry, toModel, height, openings);
    if (geometry === null) return;
    const mesh = new Mesh(resources.track(geometry), object.material);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(toModel);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });
  group.visible = false;
  return group.children.length > 0 ? group : null;
}

/** Ce que la maisonnette prête aux intérieurs: sa lampe (la seule) et sa place. */
export interface HouseLamp {
  readonly lamp: PointLight;
}

/** Accroche d'un intérieur (`interieurs[].accroches` de la carte): un petit objet posé, à condition. */
export interface InteriorHook {
  building: BuildingId;
  model: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  /** Toutes vraies pour le montrer: `given` (l'habitant a reçu son cadeau, `giftsGiven`). */
  when: { type: 'given'; villager: string }[];
}

const FACING_QUARTERS: Readonly<Record<string, number>> = { sud: 0, est: 1, nord: 2, ouest: 3 };

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/**
 * Accroches des intérieurs, lues dans les fichiers de la carte (la clé `accroches` des
 * `interieurs` n'est pas encore dans `GameMap`: lecture validée ici, une entrée invalide est
 * ignorée). Tour 10: le moulin à café d'Odette sur la tablette du guichet.
 */
export function readInteriorHooks(files: Readonly<Record<string, unknown>>): InteriorHook[] {
  const out: InteriorHook[] = [];
  for (const file of Object.values(files)) {
    const interiors = record(file)?.interieurs;
    if (!Array.isArray(interiors)) continue;
    for (const entry of interiors as unknown[]) {
      const building = record(entry);
      const id = building?.id;
      const hooks = building?.accroches;
      if (typeof id !== 'string' || !Array.isArray(hooks)) continue;
      for (const raw of hooks as unknown[]) {
        const hook = record(raw);
        if (hook === null) continue;
        const { modele, x, y, z, regarde } = hook;
        if (typeof modele !== 'string' || typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') continue;
        const when: InteriorHook['when'] = [];
        let known = true;
        for (const condition of Array.isArray(hook.visible_si) ? (hook.visible_si as unknown[]) : []) {
          const c = record(condition);
          if (c?.type === 'given' && typeof c.villager === 'string') when.push({ type: 'given', villager: c.villager });
          else known = false;
        }
        if (!known) continue;
        out.push({
          building: id,
          model: modele,
          x,
          y,
          z,
          rotation: typeof regarde === 'string' ? (FACING_QUARTERS[regarde] ?? 0) : 0,
          when,
        });
      }
    }
  }
  return out;
}

/**
 * Les bâtiments visitables autres que la maisonnette (qui reste à `HousePart`), la lampe unique
 * et le bâtiment où est le joueur local. Mise à jour après la maisonnette (elle règle la lampe
 * chez elle; ici, on la déplace si le joueur local est ailleurs).
 */
export class InteriorsPart implements EventfulPart {
  readonly group = new Group();
  private readonly buildings: OpenableBuilding[] = [];
  private readonly toCamera = new Vector3();
  private readonly houseLampPosition = new Vector3();
  private readonly houseLampColor = new Color();
  /** Couleurs des lampes, lues une fois (aucune chaîne analysée par image). */
  private readonly lampColors = new Map<string, Color>();
  /** Positions au sol des personnages dessinés (pour les portes), préallouées. */
  private readonly near: Vector3[] = [];
  private inside: BuildingId | null = null;
  /** Accroches des intérieurs, montrées avec leur intérieur et selon leur condition. */
  private readonly hooks: { hook: InteriorHook; object: Object3D }[] = [];

  constructor(
    map: GameMap,
    library: ModelLibrary,
    resources: ResourceTracker,
    private readonly house: HouseLamp,
    interiorHooks: readonly InteriorHook[] = [],
  ) {
    this.group.name = 'interieurs';
    this.houseLampPosition.copy(house.lamp.position);
    this.houseLampColor.copy(house.lamp.color);
    for (const [id, lamp] of Object.entries(RENDER_SETTINGS.interiors.lamps)) {
      this.lampColors.set(id, new Color(lamp.color));
    }
    for (const id in map.buildings) {
      const building = map.buildings[id];
      if (building === undefined || id === HOUSE_BUILDING) continue;
      const prop = map.props.find((candidate) => candidate.id === building.prop);
      if (prop === undefined) continue;
      this.buildings.push(new OpenableBuilding(building, prop, library, resources, this.group));
    }
    for (const hook of interiorHooks) {
      if (!library.has(hook.model)) continue;
      const object = library.instantiate(hook.model);
      applyShadows(object);
      object.position.set(hook.x, hook.z, hook.y);
      object.rotation.y = yawFromQuarter(hook.rotation);
      object.visible = false;
      this.group.add(object);
      this.hooks.push({ hook, object });
    }
  }

  /** Bâtiment visitable où est le joueur local à cette image (`null` dehors). */
  localInside(): BuildingId | null {
    return this.inside;
  }

  update(context: FrameContext): void {
    const world = context.world;
    const local = world.characters.find((character) => character.id === context.local);
    this.inside = local?.inside ?? null;
    this.toCamera.set(-Math.cos(context.shownYaw), 0, -Math.sin(context.shownYaw));
    let count = 0;
    const push = (x: number, y: number): void => {
      let slot = this.near[count];
      if (slot === undefined) {
        slot = new Vector3();
        this.near.push(slot);
      }
      slot.set(x, 0, y);
      count += 1;
    };
    for (const character of world.characters) push(character.pos.x, character.pos.y);
    for (const villager of world.villagers) {
      if (villager.visible) push(villager.pos.x, villager.pos.y);
    }
    for (const building of this.buildings) {
      building.apply(this.inside === building.building.id, this.toCamera, context.dt, this.near, count);
    }
    for (const { hook, object } of this.hooks) {
      object.visible =
        this.inside === hook.building && hook.when.every((c) => world.giftsGiven[c.villager] !== undefined);
    }
    this.placeLamp(context);
  }

  /** La lampe va dans le bâtiment où est le joueur local, sinon elle reste à la maisonnette. */
  private placeLamp(context: FrameContext): void {
    const lamp = this.house.lamp;
    const settings = this.inside === null ? undefined : RENDER_SETTINGS.interiors.lamps[this.inside];
    const building = this.buildings.find((candidate) => candidate.building.id === this.inside);
    if (settings === undefined || building === undefined) {
      lamp.position.copy(this.houseLampPosition);
      lamp.color.copy(this.houseLampColor);
      return;
    }
    lamp.position.set(building.roomCentre.x, settings.height, building.roomCentre.z);
    const color = this.inside === null ? undefined : this.lampColors.get(this.inside);
    if (color !== undefined) lamp.color.copy(color);
    lamp.intensity = settings.intensity * Math.max(settings.dayShare, context.night);
  }

  dispose(): void {
    for (const building of this.buildings) building.dispose();
    this.buildings.length = 0;
    this.group.removeFromParent();
  }
}

/** Ce que le rendu lit d'une pièce à bâtir (`WorldState.rooms`, tour 10, section 4.3). */
export interface RoomView {
  ordered: number | null;
  elementsBuilt: readonly string[];
  beamPlaced: boolean;
  builtDay: number | null;
}

/** Étape d'une pièce à l'écran: rien, chantier (fantômes et site), bâtie. */
export type RoomStage = 'none' | 'site' | 'built';

/** Étape d'une pièce au jour `day`: le site paraît au matin qui suit la commande. */
export function roomStage(room: RoomView | undefined, day: number): RoomStage {
  if (room === undefined) return 'none';
  if (room.builtDay !== null && day >= room.builtDay) return 'built';
  if (room.ordered !== null && day > room.ordered) return 'site';
  return 'none';
}

interface RoomElement {
  id: string;
  nodes: Object3D[];
  ghosts: Mesh[];
}

function readElements(value: unknown): { id: string; nodes: string[] }[] {
  if (!Array.isArray(value)) return [];
  const out: { id: string; nodes: string[] }[] = [];
  for (const entry of value as unknown[]) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const id = record.id_hint;
    const nodes = record.nodes;
    if (typeof id === 'string' && isStringList(nodes)) out.push({ id, nodes });
  }
  return out;
}

function midpoint(value: unknown): number {
  if (!Array.isArray(value) || value.length < 2) return 0;
  const [a, b] = value as unknown[];
  return typeof a === 'number' && typeof b === 'number' ? (a + b) / 2 : 0;
}

/**
 * Pièce de la maisonnette bâtie à deux (cellier, chambre; `gatekeeper_cellar`,
 * `gatekeeper_bedroom`, même origine et même rotation que la maisonnette): au matin du site, ses
 * nœuds de site et ses éléments en fantômes, solides à mesure qu'ils sont bâtis (`elementsBuilt`,
 * identifiants `id_hint` du modèle); bâtie, tout est solide et fusionné tant que rien n'est coupé.
 * Coupée comme la maisonnette quand le joueur local est chez lui.
 */
export class HouseRoom {
  readonly group = new Group();
  private readonly model: Object3D;
  private readonly elements: RoomElement[] = [];
  private readonly siteNodes: Object3D[] = [];
  private readonly builtNodes: Object3D[] = [];
  private readonly cutNodes = new Set<Object3D>();
  private readonly walls = new Map<Object3D, Vector3>();
  private readonly merged: Mesh[];
  private readonly opened: VisibleMerges;
  private readonly material: MeshBasicMaterial;
  private readonly worldFacing = new Vector3();
  private stage: RoomStage = 'none';

  constructor(
    readonly room: string,
    modelName: string,
    /** Élément de `pieces.json` vers l'`id_hint` du modèle. */
    private readonly elementNodes: Readonly<Record<string, string>>,
    houseProp: MapProp,
    library: ModelLibrary,
    resources: ResourceTracker,
    materials: SharedMaterials,
    host: Group,
  ) {
    this.group.name = `piece ${room}`;
    propMatrix(houseProp, 0, this.group.matrix);
    this.group.matrix.decompose(this.group.position, this.group.quaternion, this.group.scale);
    this.model = library.instantiate(modelName);
    applyShadows(this.model);
    this.group.add(this.model);
    host.add(this.group);
    this.group.updateMatrixWorld(true);
    const extras = library.extras(modelName);
    const byName = (name: string): Object3D | undefined => this.model.getObjectByName(name);
    this.material = resources.track(
      new MeshBasicMaterial({
        map: materials.paletteTexture,
        color: new Color(GHOST_TINT),
        transparent: true,
        opacity: GHOST_BASE_OPACITY,
        depthWrite: false,
      }),
    );
    for (const element of readElements(extras.elements)) {
      const nodes = element.nodes.map(byName).filter((node): node is Object3D => node !== undefined);
      const ghosts = nodes.flatMap((node) => ghostCopies(node, this.material));
      for (const ghost of ghosts) {
        ghost.visible = false;
        host.add(ghost);
      }
      this.elements.push({ id: element.id, nodes, ghosts });
    }
    for (const [list, key] of [
      [this.siteNodes, 'site_nodes'],
      [this.builtNodes, 'built_nodes'],
    ] as const) {
      const names = extras[key];
      if (isStringList(names)) {
        for (const name of names) {
          const node = byName(name);
          if (node !== undefined) list.push(node);
        }
      }
    }
    const cut = extras.cut_nodes;
    if (isStringList(cut)) {
      for (const name of cut) {
        const node = byName(name);
        if (node !== undefined) this.cutNodes.add(node);
      }
    }
    const origin = new Vector3();
    this.group.getWorldPosition(origin);
    const inverse = this.group.quaternion.clone().invert();
    const box = new Box3();
    const centre = new Vector3();
    // Les murs regardent vers le dehors de la pièce: repérés par leur place par rapport à son milieu.
    const interior = (extras.interior ?? {}) as Record<string, unknown>;
    const middle = new Vector3(midpoint(interior.x), 0, midpoint(interior.z));
    for (const child of this.model.children) {
      if (!child.name.includes('_wall_')) continue;
      box.setFromObject(child).getCenter(centre).sub(origin).applyQuaternion(inverse).sub(middle);
      const facing =
        Math.abs(centre.x) > Math.abs(centre.z)
          ? new Vector3(Math.sign(centre.x), 0, 0)
          : new Vector3(0, 0, Math.sign(centre.z));
      this.walls.set(child, facing);
    }
    const pieces = [...this.model.children];
    this.merged = mergePieces(this.model, pieces, resources) ?? [];
    for (const mesh of this.merged) this.model.add(mesh);
    this.opened = new VisibleMerges(this.model, pieces, resources);
    this.model.visible = false;
  }

  private hiddenByCut(node: Object3D, cut: boolean, toCamera: Vector3): boolean {
    if (!cut) return false;
    if (this.cutNodes.has(node)) return true;
    const facing = this.walls.get(node);
    if (facing === undefined) return false;
    this.worldFacing.copy(facing).applyQuaternion(this.group.quaternion);
    return this.worldFacing.dot(toCamera) > WALL_FACES_CAMERA;
  }

  /** Une image: étape de la pièce, coupe (joueur local chez lui), pulsation des fantômes. */
  apply(state: RoomView | undefined, day: number, cut: boolean, toCamera: Vector3, time: number): RoomStage {
    const stage = roomStage(state, day);
    this.stage = stage;
    this.model.visible = stage !== 'none';
    const built = stage === 'built';
    const whole = built && !cut && this.merged.length > 0;
    for (const child of this.model.children) {
      child.visible = false;
    }
    for (const mesh of this.merged) mesh.visible = whole;
    if (stage === 'none' || built) {
      for (const element of this.elements) for (const ghost of element.ghosts) ghost.visible = false;
      if (built && !whole) {
        for (const child of this.model.children) {
          if (!this.merged.includes(child as Mesh)) child.visible = !this.hiddenByCut(child, cut, toCamera);
        }
        this.opened.apply();
      } else {
        this.opened.hide();
      }
      return stage;
    }
    for (const node of this.siteNodes) node.visible = !this.hiddenByCut(node, cut, toCamera);
    for (const node of this.builtNodes) node.visible = false;
    const pulse = Math.sin(time * Math.PI * 2 * RENDER_SETTINGS.effects.highlightPulseHz) * GHOST_PULSE;
    this.material.opacity = GHOST_BASE_OPACITY + pulse;
    for (const element of this.elements) {
      let solid = false;
      for (const built of state?.elementsBuilt ?? []) solid ||= (this.elementNodes[built] ?? built) === element.id;
      let away = false;
      for (const node of element.nodes) {
        const hidden = this.hiddenByCut(node, cut, toCamera);
        away ||= hidden;
        node.visible = solid && !hidden;
      }
      for (const ghost of element.ghosts) ghost.visible = !solid && !away;
    }
    return stage;
  }

  /** Étape montrée à la dernière image. */
  shownStage(): RoomStage {
    return this.stage;
  }

  dispose(): void {
    for (const element of this.elements) for (const ghost of element.ghosts) ghost.removeFromParent();
    this.group.removeFromParent();
  }
}
