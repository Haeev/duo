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
  PointLight,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import type { GameMap, MapProp } from '../etat/carte';
import type {
  CharacterId,
  ConstructionState,
  DeepReadonly,
  PlacedFurniture,
  PlacementPreview,
} from '../etat/types';
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

export interface StagedState {
  repaired: boolean;
  /** La construction a commencé: les restes du vieux toit laissent place aux fantômes. */
  hideRuinRoof: boolean;
  constructions: readonly DeepReadonly<ConstructionState>[];
  time: number;
  cut: boolean;
  toCamera: Vector3;
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
  private readonly elements: ElementPart[] = [];
  private readonly parts: BuildPart[] = [];
  private readonly fixed: Object3D[] = [];
  private readonly centre = new Vector3();
  private readonly worldFacing = new Vector3();

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
      model.traverse((object) => {
        object.castShadow = true;
        object.receiveShadow = true;
      });
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
    }
  }

  center(): Vector3 {
    return this.centre;
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
  private readonly ghosts = new Map<
    CharacterId,
    { item: string; object: Object3D; material: MeshBasicMaterial }
  >();
  private readonly toCamera = new Vector3();
  /** Toujours présente (intensité nulle le jour): le nombre de lumières ne change jamais, donc aucun programme recompilé. */
  readonly lamp = new PointLight(
    RENDER_SETTINGS.house.lampColor,
    0,
    RENDER_SETTINGS.house.lampDistance,
    2,
  );
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
    const room = map.house.room;
    this.lamp.position.set(
      room.x + room.w / 2,
      RENDER_SETTINGS.house.lampHeight,
      room.y + room.h / 2,
    );
    this.group.add(this.lamp);
    const houseProp = map.props.find((prop) => prop.model === HOUSE_PROP);
    if (houseProp !== undefined) {
      const house = new StagedBuilding(
        houseProp,
        0,
        library,
        resources,
        materials,
        { ruin: `${HOUSE_PROP}_ruin`, repaired: `${HOUSE_PROP}_repaired` },
        this.group,
      );
      const roof = content.constructions.find((construction) => construction.id === 'house_roof');
      const roofNode = `${HOUSE_PROP}_repaired_roof_part_`;
      roof?.elements.forEach((element, index) => {
        house.bindElement(
          'house_roof',
          element.id,
          `${roofNode}${String(index + 1).padStart(2, '0')}`,
          true,
        );
      });
      // La poutre portée à deux devient le faîtage, la pièce qui suit les éléments du toit.
      house.bindElement(
        'house_beam',
        'house_beam',
        `${roofNode}${String((roof?.elements.length ?? 0) + 1).padStart(2, '0')}`,
        true,
      );
      const door = content.constructions.find((construction) => construction.id === 'house_door');
      for (const element of door?.elements ?? []) {
        house.bindElement('house_door', element.id, `${HOUSE_PROP}_repaired_door`, false);
      }
      house.finish(/_roof$|_attic$/, /_wall_/);
      this.house = house;
    }
    const coopProp = map.props.find((prop) => prop.model === COOP_PROP);
    if (coopProp !== undefined) {
      const coop = new StagedBuilding(
        coopProp,
        this.terrain.heightAt(coopProp.pos.x, coopProp.pos.y),
        library,
        resources,
        materials,
        { ruin: `${COOP_PROP}_ruin`, repaired: `${COOP_PROP}_repaired` },
        this.group,
      );
      const parts: readonly [string, string][] = [
        ['coop_floor', 'ramp'],
        ['coop_wall_left', 'walls'],
        ['coop_wall_right', 'fence'],
        ['coop_roof', 'roof'],
        ['coop_roof', 'door'],
      ];
      for (const [element, node] of parts) {
        coop.bindElement('chicken_coop', element, `${COOP_PROP}_repaired_${node}`, false);
      }
      coop.finish(/^$/, /^$/);
      this.coop = coop;
    }
  }

  /** Centre d'un élément de construction (poussière quand il est fini). */
  elementCenter(construction: string, element: string, out: Vector3): Vector3 | null {
    if (construction === 'chicken_coop') {
      return this.coop?.elementCenter(element, out) ?? null;
    }
    return this.house?.elementCenter(element, out) ?? null;
  }

  update(context: FrameContext): void {
    const world = context.world;
    const local = world.characters.find((character) => character.id === context.local);
    const inside = local?.inHouse === true;
    this.toCamera.set(-Math.cos(context.shownYaw), 0, -Math.sin(context.shownYaw));
    const find = (id: string): DeepReadonly<ConstructionState> | undefined =>
      world.constructions.find((construction) => construction.id === id);

    const done = (id: string): boolean => find(id)?.status === 'done';
    const lit =
      !RENDER_SETTINGS.house.lampNeedsRepair || (done('house_roof') && done('house_door'));
    this.lamp.intensity = lit ? context.night * RENDER_SETTINGS.house.lampIntensity : 0;
    this.house?.apply({
      repaired: done('house_roof') && done('house_door'),
      hideRuinRoof: find('house_roof')?.status !== 'locked',
      constructions: world.constructions,
      time: context.time,
      cut: inside,
      toCamera: this.toCamera,
    });
    this.coop?.apply({
      repaired: done('chicken_coop'),
      hideRuinRoof: false,
      constructions: world.constructions,
      time: context.time,
      cut: false,
      toCamera: this.toCamera,
    });
    if (this.coop !== null) {
      // Pendant le chantier du poulailler, la ruine s'efface derrière les fantômes.
      this.coop.ruin.visible = find('chicken_coop')?.status === 'locked';
    }
    // Sous le toit réparé, les meubles ne se voient que de l'intérieur: inutile de les dessiner.
    const roofed = done('house_roof') && !inside;
    this.updateFurniture(world.furniture, roofed);
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
    const object = this.library.instantiate(definition?.model ?? item, {
      width: size.w,
      depth: size.d,
    });
    object.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = true;
    });
    return object;
  }

  private updateFurniture(placed: readonly DeepReadonly<PlacedFurniture>[], hidden: boolean): void {
    const seen = new Set<string>();
    for (const piece of placed) {
      seen.add(piece.id);
      let view = this.furniture.get(piece.id);
      if (view?.item !== piece.item) {
        if (view !== undefined) {
          view.object.removeFromParent();
          this.picks.remove(view.pick);
        }
        view = {
          item: piece.item,
          object: this.modelFor(piece.item),
          pick: this.picks.add({ kind: 'furniture', furniture: piece.id }),
        };
        this.group.add(view.object);
        this.furniture.set(piece.id, view);
      }
      this.place(view.object, piece.item, piece.cell.cx, piece.cell.cy, piece.rotation);
      view.object.visible = !hidden;
      const size = this.footprint(piece.item, piece.rotation);
      const ground = view.object.position.y;
      view.pick.box.min.set(
        piece.cell.cx + FURNITURE_PICK_INSET,
        ground,
        piece.cell.cy + FURNITURE_PICK_INSET,
      );
      view.pick.box.max.set(
        piece.cell.cx + size.w - FURNITURE_PICK_INSET,
        ground + FURNITURE_PICK_HEIGHT,
        piece.cell.cy + size.d - FURNITURE_PICK_INSET,
      );
      view.pick.enabled = !hidden;
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
            new MeshBasicMaterial({
              map: this.materials.paletteTexture,
              transparent: true,
              opacity: PLACEMENT_OPACITY,
              depthWrite: false,
            }),
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
      ghost.material.color.set(
        preview.valid ? safeColor(character.appearance.scarf) : INVALID_TINT,
      );
      ghost.material.opacity =
        PLACEMENT_OPACITY +
        Math.sin(context.time * Math.PI * 2 * RENDER_SETTINGS.effects.highlightPulseHz) *
          GHOST_PULSE;
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
