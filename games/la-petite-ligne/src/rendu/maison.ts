/**
 * La maisonnette du garde-barrière et le poulailler: en ruine, puis bâtis
 * élément par élément (fantômes transparents qui deviennent solides), les
 * meubles posés, l'aperçu fantôme d'un meuble en main (à la couleur du joueur)
 * et la coupe des murs et du toit quand le personnage local est à l'intérieur.
 */
import {
  Box3,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import type { GameMap, MapProp } from '../etat/carte';
import type { CharacterId, ConstructionState, DeepReadonly, PlacedFurniture, PlacementPreview } from '../etat/types';
import type { Content } from '../donnees/types';
import { safeColor } from './apparence';
import { yawFromQuarter, type FrameContext, type PickRegistry, type PickTarget } from './contexte';
import { propHints, propMatrix } from './decor';
import type { SharedMaterials } from './materiaux';
import type { ModelLibrary } from './modeles';
import type { EventfulPart } from './monde';
import { RENDER_SETTINGS } from './reglages';
import type { ResourceTracker } from './ressources';
import type { Terrain } from './terrain';

const HOUSE_PROP = 'gatekeeper_house';
const COOP_PROP = 'henhouse';
const GHOST_TINT = '#fff1cf';
const GHOST_BASE_OPACITY = 0.22;
const GHOST_PROGRESS_OPACITY = 0.5;
const GHOST_PULSE = 0.08;
const INVALID_TINT = '#d9584f';
const PLACEMENT_OPACITY = 0.55;
/** Seuil du produit scalaire: un mur qui regarde la caméra au-delà est coupé. */
const WALL_FACES_CAMERA = 0.25;
const FURNITURE_PICK_HEIGHT = 1;
const FURNITURE_PICK_INSET = 0.05;

/** Une pièce de bâtiment qui peut être cachée, fantôme ou solide. */
interface BuildPart {
  solid: Object3D;
  ghost: Mesh[];
  material: MeshBasicMaterial | null;
  /** Direction (au sol) vers laquelle regarde un mur, pour la coupe; `null` pour le reste. */
  facing: Vector3 | null;
  roof: boolean;
}

function ghostCopies(source: Object3D, material: Material): Mesh[] {
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
class StagedBuilding {
  readonly group = new Group();
  readonly ruin: Object3D;
  readonly repaired: Object3D;
  private readonly elementParts = new Map<string, BuildPart>();
  private readonly staticParts: BuildPart[] = [];
  private readonly centre = new Vector3();

  constructor(
    prop: MapProp,
    ground: number,
    private readonly library: ModelLibrary,
    private readonly resources: ResourceTracker,
    private readonly materials: SharedMaterials,
    names: { ruin: string; repaired: string },
  ) {
    this.group.name = prop.model;
    propMatrix(prop, ground, this.group.matrix);
    this.group.matrix.decompose(this.group.position, this.group.quaternion, this.group.scale);
    this.ruin = library.instantiate(library.has(names.ruin) ? names.ruin : prop.model, propHints(prop));
    this.repaired = library.has(names.repaired) ? library.instantiate(names.repaired, propHints(prop)) : this.ruin;
    for (const model of [this.ruin, this.repaired]) {
      model.traverse((object) => {
        object.castShadow = true;
        object.receiveShadow = true;
      });
      this.group.add(model);
    }
    this.group.updateMatrixWorld(true);
    new Box3().setFromObject(this.repaired).getCenter(this.centre);
  }

  /** Associe un élément de construction à un nœud du modèle réparé (ou de la ruine). */
  bindElement(elementId: string, nodeName: string, roof: boolean): void {
    const solid = this.repaired.getObjectByName(nodeName);
    if (solid === undefined) {
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
    const ghost = ghostCopies(solid, material);
    for (const mesh of ghost) {
      this.group.parent?.add(mesh);
    }
    this.elementParts.set(elementId, { solid, ghost, material, facing: null, roof });
  }

  /** Repère les murs (par la position de leur centre) et le toit, pour la coupe. */
  indexCutParts(model: Object3D, roofPattern: RegExp, wallPattern: RegExp): void {
    const box = new Box3();
    const centre = new Vector3();
    const origin = new Vector3();
    this.group.getWorldPosition(origin);
    model.traverse((object) => {
      if (object.parent !== model) {
        return;
      }
      if (roofPattern.test(object.name)) {
        this.staticParts.push({ solid: object, ghost: [], material: null, facing: null, roof: true });
      } else if (wallPattern.test(object.name)) {
        box.setFromObject(object).getCenter(centre).sub(origin);
        centre.y = 0;
        const facing = Math.abs(centre.x) > Math.abs(centre.z) ? new Vector3(Math.sign(centre.x), 0, 0) : new Vector3(0, 0, Math.sign(centre.z));
        this.staticParts.push({ solid: object, ghost: [], material: null, facing, roof: false });
      }
    });
  }

  /** Centre du bâtiment (effets: poussière quand un élément est fini). */
  center(): Vector3 {
    return this.centre;
  }

  elementCenter(elementId: string, out: Vector3): Vector3 {
    const part = this.elementParts.get(elementId);
    if (part === undefined) {
      return out.copy(this.centre);
    }
    return new Box3().setFromObject(part.solid).getCenter(out);
  }

  /**
   * Met les éléments à l'état de la construction: caché (verrouillée), fantôme
   * qui se remplit avec la progression, ou solide.
   */
  applyConstruction(construction: DeepReadonly<ConstructionState> | undefined, time: number, cut: boolean): void {
    const pulse = Math.sin(time * Math.PI * 2 * RENDER_SETTINGS.effects.highlightPulseHz) * GHOST_PULSE;
    for (const [id, part] of this.elementParts) {
      const element = construction?.elements.find((candidate) => candidate.id === id);
      const status = construction?.status ?? 'locked';
      const solid = status === 'done' || element?.done === true;
      const ghost = status === 'ghost' && !solid;
      const hiddenByCut = cut && part.roof;
      part.solid.visible = solid && !hiddenByCut;
      for (const mesh of part.ghost) {
        mesh.visible = ghost && !hiddenByCut;
      }
      if (ghost && part.material !== null) {
        part.material.opacity = GHOST_BASE_OPACITY + GHOST_PROGRESS_OPACITY * (element?.progress ?? 0) + pulse;
      }
    }
  }

  /** Coupe le toit et les murs tournés vers la caméra (personnage local à l'intérieur). */
  applyCut(cut: boolean, toCamera: Vector3): void {
    for (const part of this.staticParts) {
      if (part.roof) {
        part.solid.visible = part.solid.visible && !cut;
        continue;
      }
      if (part.facing === null) {
        continue;
      }
      const facing = part.facing.clone().applyQuaternion(this.group.quaternion);
      part.solid.visible = !(cut && facing.dot(toCamera) > WALL_FACES_CAMERA);
    }
  }

  dispose(): void {
    for (const part of this.elementParts.values()) {
      for (const mesh of part.ghost) {
        mesh.removeFromParent();
      }
    }
    this.group.removeFromParent();
  }
}

interface FurnitureView {
  item: string;
  object: Object3D;
  pick: PickTarget;
}

export class HousePart implements EventfulPart {
  readonly group = new Group();
  private house: StagedBuilding | null = null;
  private coop: StagedBuilding | null = null;
  private readonly furniture = new Map<string, FurnitureView>();
  private readonly ghosts = new Map<CharacterId, { item: string; object: Object3D; material: MeshBasicMaterial }>();
  private readonly toCamera = new Vector3();
  private readonly tmp = new Vector3();

  constructor(
    private readonly map: GameMap,
    private readonly content: Content,
    private readonly library: ModelLibrary,
    private readonly materials: SharedMaterials,
    private readonly terrain: Terrain,
    private readonly resources: ResourceTracker,
    private readonly picks: PickRegistry,
  ) {
    this.group.name = 'maisonnette';
    const houseProp = map.props.find((prop) => prop.model === HOUSE_PROP);
    if (houseProp !== undefined) {
      const house = new StagedBuilding(houseProp, 0, library, resources, materials, {
        ruin: `${HOUSE_PROP}_ruin`,
        repaired: `${HOUSE_PROP}_repaired`,
      });
      this.group.add(house.group);
      const roof = content.constructions.find((construction) => construction.id === 'house_roof');
      const roofNode = `${HOUSE_PROP}_repaired_roof_part_`;
      roof?.elements.forEach((element, index) => {
        house.bindElement(element.id, `${roofNode}${String(index + 1).padStart(2, '0')}`, true);
      });
      const beamIndex = (roof?.elements.length ?? 0) + 1;
      house.bindElement('house_beam', `${roofNode}${String(beamIndex).padStart(2, '0')}`, true);
      const door = content.constructions.find((construction) => construction.id === 'house_door');
      for (const element of door?.elements ?? []) {
        house.bindElement(element.id, `${HOUSE_PROP}_repaired_door`, false);
      }
      house.indexCutParts(house.ruin, /_roof$|_attic$/, /_wall_/);
      if (house.repaired !== house.ruin) {
        house.indexCutParts(house.repaired, /_attic$/, /_wall_/);
      }
      this.house = house;
    }
    const coopProp = map.props.find((prop) => prop.model === COOP_PROP);
    if (coopProp !== undefined) {
      const coop = new StagedBuilding(coopProp, this.terrain.heightAt(coopProp.pos.x, coopProp.pos.y), library, resources, materials, {
        ruin: `${COOP_PROP}_ruin`,
        repaired: `${COOP_PROP}_repaired`,
      });
      this.group.add(coop.group);
      const parts: Record<string, string> = {
        coop_floor: `${COOP_PROP}_repaired_ramp`,
        coop_wall_left: `${COOP_PROP}_repaired_walls`,
        coop_wall_right: `${COOP_PROP}_repaired_door`,
        coop_roof: `${COOP_PROP}_repaired_roof`,
      };
      for (const [element, node] of Object.entries(parts)) {
        coop.bindElement(element, node, false);
      }
      this.coop = coop;
    }
  }

  /** Centre d'un élément de construction (poussière quand il est fini). */
  elementCenter(construction: string, element: string, out: Vector3): Vector3 | null {
    if (construction === 'chicken_coop') {
      return this.coop?.elementCenter(element, out) ?? null;
    }
    return this.house?.elementCenter(construction === 'house_beam' ? 'house_beam' : element, out) ?? null;
  }

  private stagedState(building: StagedBuilding, constructions: readonly DeepReadonly<ConstructionState>[], ids: readonly string[]): boolean {
    const all = ids.map((id) => constructions.find((construction) => construction.id === id));
    return all.every((construction) => construction?.status === 'done');
  }

  update(context: FrameContext): void {
    const world = context.world;
    const local = world.characters.find((character) => character.id === context.local);
    const inside = local?.inHouse === true;
    this.toCamera.set(-Math.cos(context.shownYaw), 0, -Math.sin(context.shownYaw));
    const find = (id: string): DeepReadonly<ConstructionState> | undefined =>
      world.constructions.find((construction) => construction.id === id);

    if (this.house !== null) {
      const repaired = this.stagedState(this.house, world.constructions, ['house_roof', 'house_door']);
      this.house.ruin.visible = !repaired || this.house.repaired === this.house.ruin;
      this.house.repaired.visible = repaired;
      // Pendant le chantier, les restes du vieux toit laissent place aux fantômes.
      const roofWork = find('house_roof')?.status !== 'locked';
      const ruinRoof = this.house.ruin.getObjectByName(`${HOUSE_PROP}_ruin_roof`);
      if (ruinRoof !== undefined) {
        ruinRoof.visible = !roofWork;
      }
      this.house.applyConstruction(find('house_roof'), context.time, inside);
      this.house.applyConstruction(find('house_door'), context.time, inside);
      this.house.applyConstruction(find('house_beam'), context.time, inside);
      this.house.applyCut(inside, this.toCamera);
    }
    if (this.coop !== null) {
      const repaired = this.stagedState(this.coop, world.constructions, ['chicken_coop']);
      const working = find('chicken_coop')?.status === 'ghost';
      this.coop.repaired.visible = repaired;
      this.coop.ruin.visible = !repaired && this.coop.repaired !== this.coop.ruin;
      if (working) {
        this.coop.ruin.traverse((object) => {
          if (/_(walls|roof|door)$/.test(object.name)) {
            object.visible = false;
          }
        });
      }
      this.coop.applyConstruction(find('chicken_coop'), context.time, false);
    }
    this.updateFurniture(world.furniture);
    this.updateGhosts(context);
  }

  private footprint(item: string, rotation: number): { w: number; d: number } {
    const size = this.content.items[item]?.footprint ?? { w: 1, d: 1 };
    return rotation % 2 === 0 ? size : { w: size.d, d: size.w };
  }

  private place(object: Object3D, item: string, cx: number, cy: number, rotation: number): void {
    const size = this.footprint(item, rotation);
    const x = cx + size.w / 2;
    const y = cy + size.d / 2;
    object.position.set(x, this.terrain.heightAt(x, y), y);
    object.rotation.y = yawFromQuarter(rotation);
  }

  private modelFor(item: string): Object3D {
    const definition = this.content.items[item];
    const size = definition?.footprint ?? { w: 1, d: 1 };
    const object = this.library.instantiate(definition?.model ?? item, { width: size.w, depth: size.d });
    object.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = true;
    });
    return object;
  }

  private updateFurniture(placed: readonly DeepReadonly<PlacedFurniture>[]): void {
    const seen = new Set<string>();
    for (const piece of placed) {
      seen.add(piece.id);
      let view = this.furniture.get(piece.id);
      if (view?.item !== piece.item) {
        if (view !== undefined) {
          view.object.removeFromParent();
          this.picks.remove(view.pick);
        }
        view = { item: piece.item, object: this.modelFor(piece.item), pick: this.picks.add({ kind: 'furniture', furniture: piece.id }) };
        this.group.add(view.object);
        this.furniture.set(piece.id, view);
      }
      this.place(view.object, piece.item, piece.cell.cx, piece.cell.cy, piece.rotation);
      const size = this.footprint(piece.item, piece.rotation);
      const ground = view.object.position.y;
      view.pick.box.min.set(piece.cell.cx + FURNITURE_PICK_INSET, ground, piece.cell.cy + FURNITURE_PICK_INSET);
      view.pick.box.max.set(piece.cell.cx + size.w - FURNITURE_PICK_INSET, ground + FURNITURE_PICK_HEIGHT, piece.cell.cy + size.d - FURNITURE_PICK_INSET);
      view.pick.enabled = true;
    }
    for (const [id, view] of this.furniture) {
      if (!seen.has(id)) {
        view.object.removeFromParent();
        this.picks.remove(view.pick);
        this.furniture.delete(id);
      }
    }
  }

  /** Aperçu fantôme du meuble en main de chaque joueur, à sa couleur (rouge s'il ne peut pas être posé). */
  private updateGhosts(context: FrameContext): void {
    for (const character of context.world.characters) {
      const preview: DeepReadonly<PlacementPreview> | null = character.placement;
      let ghost = this.ghosts.get(character.id);
      if (preview === null) {
        if (ghost !== undefined) {
          ghost.object.visible = false;
        }
        continue;
      }
      if (ghost?.item !== preview.item) {
        ghost?.object.removeFromParent();
        const material =
          ghost?.material ??
          this.resources.track(
            new MeshBasicMaterial({ map: this.materials.paletteTexture, transparent: true, opacity: PLACEMENT_OPACITY, depthWrite: false }),
          );
        const object = this.modelFor(preview.item);
        object.traverse((child) => {
          if (child instanceof Mesh) {
            child.material = material;
            child.castShadow = false;
            child.renderOrder = 2;
          }
        });
        this.group.add(object);
        ghost = { item: preview.item, object, material };
        this.ghosts.set(character.id, ghost);
      }
      ghost.object.visible = true;
      ghost.material.color.set(preview.valid ? safeColor(character.appearance.scarf) : INVALID_TINT);
      ghost.material.opacity = PLACEMENT_OPACITY + Math.sin(context.time * Math.PI * 2 * RENDER_SETTINGS.effects.highlightPulseHz) * GHOST_PULSE;
      this.place(ghost.object, preview.item, preview.cell.cx, preview.cell.cy, preview.rotation);
    }
  }

  /** Point de la maison (effets, poussière), dans le repère du monde. */
  houseCenter(): Vector3 {
    return this.house?.center() ?? this.tmp.set(this.map.house.room.x, 0, this.map.house.room.y);
  }

  dispose(): void {
    this.house?.dispose();
    this.coop?.dispose();
    for (const view of this.furniture.values()) {
      this.picks.remove(view.pick);
    }
    this.furniture.clear();
    this.ghosts.clear();
    this.group.removeFromParent();
  }
}
