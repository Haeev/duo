/**
 * La maisonnette du garde-barrière et le poulailler: en ruine, puis bâtis
 * élément par élément (fantômes transparents qui deviennent solides), les
 * meubles posés, l'aperçu fantôme d'un meuble en main (à la couleur du joueur),
 * le cadre au sol du coin à soi de chacun (à sa couleur) et la coupe des murs
 * et du toit quand le personnage local est à l'intérieur.
 */
import {
  Box3,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PointLight,
  Raycaster,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three';
import { HOUSE_BUILDING, type GameMap } from '../etat/carte';
import {
  CORNER_SIZE,
  type CharacterId,
  type ConstructionState,
  type DeepReadonly,
  type ItemStack,
  type PlacedDecor,
  type PlacedFurniture,
  type PlacementPreview,
} from '../etat/types';
import type { Content } from '../donnees/types';
import { seasonOfDay } from '../donnees/calendrier';
import { safeColor } from './apparence';
import { yawFromQuarter, type FrameContext, type PickRegistry, type PickTarget } from './contexte';
import { propMatrix } from './decor';
import {
  GHOST_PULSE,
  HouseRoom,
  mergePieces,
  roomStage,
  StagedBuilding,
  WALL_FACES_CAMERA,
  type RoomView,
} from './interieurs';
import { ShapeBuilder } from './geometrie';
import type { SharedMaterials } from './materiaux';
import type { ModelLibrary } from './modeles';
import type { EventfulPart } from './monde';
import { applyShadows } from './ombre-tri';
import { RENDER_SETTINGS } from './reglages';
import type { ResourceTracker } from './ressources';
import type { Terrain } from './terrain';

const HOUSE_PROP = 'gatekeeper_house';
const COOP_PROP = 'henhouse';
const INVALID_TINT = '#d9584f';
const PLACEMENT_OPACITY = 0.55;
/** Cadre du coin à soi: baguettes fines posées au sol, en retrait du bord des cases (m). */
const CORNER_INSET = 0.08;
const CORNER_THICKNESS = 0.05;
const CORNER_HEIGHT = 0.015;
/** Au-dessus du sol et d'un tapis. */
const CORNER_LIFT = 0.03;
/** Piquets aux quatre angles: le coin reste lisible quand des meubles couvrent le cadre (m). */
const CORNER_PEG_SIZE = 0.07;
const CORNER_PEG_HEIGHT = 0.3;
const CORNER_OPACITY = 0.5;
const FURNITURE_PICK_HEIGHT = 1;
const FURNITURE_PICK_INSET = 0.05;

/** Un petit objet posé sur le dessus d'un meuble (S03). */
interface DecorView {
  item: string;
  object: Object3D;
  pick: PickTarget;
}

/** Marge (m) au-dessus d'un petit objet posé pour la viser à la souris. */
const DECOR_PICK_MARGIN = 0.05;
const DOWN = new Vector3(0, -1, 0);

interface FurnitureView {
  item: string;
  /** Rideaux: la fenêtre où ils pendent (`window_<n>`), `null` pour le reste. */
  window: string | null;
  object: Object3D;
  /** Rideaux: les deux états de l'article (`<article>_open`, `<article>_closed`). */
  curtain: { open: Object3D; closed: Object3D } | null;
  pick: PickTarget;
  /** Râtelier: les outils pendus (clé: liste des outils), refaits quand elle change. */
  rack: { key: string; tools: Object3D[] } | null;
}

/** Une fenêtre de la maisonnette ou de ses pièces (extra `windows` du modèle, repère de la maisonnette). */
interface WindowSpec {
  centre: Vector3;
  /** Vers la pièce, au sol. */
  inward: Vector3;
  width: number;
  height: number;
  /** Pièce: `main`, `cellar`, `bedroom`. */
  room: string;
}

/** Modèle des rideaux à une fenêtre (`maison.glb`) et son gabarit (0,75 x 0,9 m). */
const CURTAIN_MODEL = 'curtains_window';
const CURTAIN_ROD = 'curtains_rod';
const CURTAIN_SIZE = { width: 0.75, height: 0.9 } as const;
/** Pièce de la maisonnette d'une fenêtre, et la pièce à bâtir qui la porte (rien pour `main`). */
const WINDOW_ROOMS: Readonly<Record<string, string>> = { cellar: 'room_cellar', bedroom: 'room_bedroom' };
/** Râtelier (tour 10, section 5.3) et le nombre de crochets entre deux outils pendus (lisibles). */
const RACK_MODEL = 'tool_rack';
const RACK_HOOK_STEP = 3;
/** Un outil pendu par le bout du manche: son origine (la prise) sous le crochet (m). */
const RACK_HANG_DROP = 0.18;

function readWindows(value: unknown): Map<string, WindowSpec> {
  const out = new Map<string, WindowSpec>();
  if (!Array.isArray(value)) return out;
  for (const entry of value as unknown[]) {
    if (typeof entry !== 'object' || entry === null) continue;
    const w = entry as Record<string, unknown>;
    const centre = w.center;
    const inward = w.inward;
    if (
      typeof w.node !== 'string' ||
      !Array.isArray(centre) ||
      !Array.isArray(inward) ||
      typeof w.width !== 'number' ||
      typeof w.height !== 'number'
    ) {
      continue;
    }
    const [cx, cy, cz] = centre as unknown[];
    const [ix, , iz] = inward as unknown[];
    if (typeof cx !== 'number' || typeof cy !== 'number' || typeof cz !== 'number') continue;
    if (typeof ix !== 'number' || typeof iz !== 'number') continue;
    out.set(w.node, {
      centre: new Vector3(cx, cy, cz),
      inward: new Vector3(ix, 0, iz),
      width: w.width,
      height: w.height,
      room: typeof w.room === 'string' ? w.room : 'main',
    });
  }
  return out;
}

export class HousePart implements EventfulPart {
  readonly group = new Group();
  private house: StagedBuilding | null = null;
  private coop: StagedBuilding | null = null;
  private readonly furniture = new Map<string, FurnitureView>();
  private readonly decor = new Map<string, DecorView>();
  /** Hauteur du dessus de chaque place (`modèle:x:z`), lue une fois dans la géométrie du modèle. */
  private readonly topHeights = new Map<string, number>();
  private readonly raycaster = new Raycaster();
  private readonly decorBox = new Box3();
  private readonly decorPoint = new Vector3();
  private readonly probeFrom = new Vector3();
  private readonly ghosts = new Map<
    CharacterId,
    { item: string; object: Object3D; material: MeshBasicMaterial }
  >();
  /** Cadre au sol du coin de chaque joueur (une géométrie partagée, un matériau à sa couleur). */
  private readonly corners = new Map<
    CharacterId,
    { mesh: Mesh; material: MeshBasicMaterial; color: string }
  >();
  private cornerGeometry: BufferGeometry | null = null;
  private readonly toCamera = new Vector3();
  /** Toujours présente (intensité nulle le jour): le nombre de lumières ne change jamais, donc aucun programme recompilé. */
  readonly lamp = new PointLight(
    RENDER_SETTINGS.house.lampColor,
    0,
    RENDER_SETTINGS.house.lampDistance,
    2,
  );
  private readonly tmp = new Vector3();
  private readonly wallFacing = new Vector3();

  /**
   * Quart de tour d'un objet mural posé sur la case (cx, cy): dos au mur de la pièce que touche la
   * case (le modèle a son dos à -Z, au bord de la case). La rotation choisie par le joueur est
   * gardée si elle met déjà le dos contre un mur; sinon le premier mur touché (nord, ouest, est, sud).
   */
  private wallRotation(cx: number, cy: number, wanted: number): number {
    const room = this.map.house.room;
    const walls: number[] = [];
    // Quart 0: devant vers le sud, dos au nord; 1: dos à l'ouest; 3: dos à l'est; 2: dos au sud.
    if (cy === room.y) walls.push(0);
    if (cx === room.x) walls.push(1);
    if (cx === room.x + room.w - 1) walls.push(3);
    if (cy === room.y + room.h - 1) walls.push(2);
    const turn = ((wanted % 4) + 4) % 4;
    return walls.includes(turn) ? turn : (walls[0] ?? turn);
  }

  /** Le personnage local était dedans à la dernière image (murs face à la caméra coupés). */
  private cutInside = false;

  /**
   * Le mur de la maisonnette tourné vers `facing` (repère du monde, au sol) est-il coupé à cette
   * image ? Lu par ce qui s'y accroche dehors (l'auvent du tour 9) ou dedans (objets muraux).
   */
  wallCut(facing: Vector3): boolean {
    return this.cutInside && facing.dot(this.toCamera) > WALL_FACES_CAMERA;
  }

  /** La maisonnette est-elle réparée (toit et porte faits) à cette image ? */
  isRepaired(): boolean {
    return this.repairedNow;
  }

  private repairedNow = false;

  /** Pièces bâties à deux (tour 10): leur vue, leur mur percé une fois bâties, le site. */
  private readonly rooms: {
    view: HouseRoom;
    def: { model: string; wall: string; doorWall: string; site: string; elements: Readonly<Record<string, string>> };
    swapped: boolean;
    site: Object3D[];
  }[] = [];

  /** Caisse et planches au point du chantier d'une pièce (montrées pendant le site). */
  private siteProps(point: string): Object3D[] {
    const at = this.map.points[point];
    if (at === undefined) return [];
    return RENDER_SETTINGS.interiors.siteProps.map((name, index) => {
      const object = this.library.instantiate(name);
      applyShadows(object);
      // Côte à côte, en travers du point (la caisse à l'ouest, les planches à l'est).
      const x = at.x + (index - 0.5) * 0.9;
      object.position.set(x, this.terrain.heightAt(x, at.y), at.y);
      object.visible = false;
      this.group.add(object);
      return object;
    });
  }

  /** Le toit est-il coupé à cette image (personnage local dedans) ? */
  roofCut(): boolean {
    return this.cutInside;
  }

  private readonly up = new Vector3(0, 1, 0);
  private lastWorldRooms: DeepReadonly<Record<string, RoomView>> = {};
  private lastDay = 0;

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
    this.windows = readWindows(library.extras(HOUSE_PROP).windows);
    const houseAt = map.props.find((prop) => prop.model === HOUSE_PROP);
    this.houseYaw = yawFromQuarter(houseAt?.rotation ?? 0);
    if (houseAt !== undefined) propMatrix(houseAt, 0, this.housePose);
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
      // Tour 10: cellier et chambre, bâtis à deux (même origine que la maisonnette).
      for (const [room, def] of Object.entries(RENDER_SETTINGS.interiors.houseRooms)) {
        if (!library.has(def.model)) continue;
        this.rooms.push({
          view: new HouseRoom(room, def.model, def.elements, houseProp, library, resources, materials, this.group),
          def,
          swapped: false,
          site: this.siteProps(def.site),
        });
      }
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
    // ADR 0016: « chez soi », c'est être dans le bâtiment `house` (cellier et chambre compris).
    const inside = local?.inside === HOUSE_BUILDING;
    this.cutInside = inside;
    this.toCamera.set(-Math.cos(context.shownYaw), 0, -Math.sin(context.shownYaw));
    const find = (id: string): DeepReadonly<ConstructionState> | undefined =>
      world.constructions.find((construction) => construction.id === id);

    const done = (id: string): boolean => find(id)?.status === 'done';
    const lit =
      !RENDER_SETTINGS.house.lampNeedsRepair || (done('house_roof') && done('house_door'));
    this.lamp.intensity = lit ? context.night * RENDER_SETTINGS.house.lampIntensity : 0;
    this.repairedNow = done('house_roof') && done('house_door');
    this.house?.apply({
      repaired: this.repairedNow,
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
    this.lastWorldRooms = world.rooms;
    this.lastDay = world.clock.day;
    for (const room of this.rooms) {
      const stage = room.view.apply(world.rooms[room.view.room], world.clock.day, inside, this.toCamera, context.time);
      for (const object of room.site) object.visible = stage === 'site';
      if (stage === 'built' && !room.swapped && this.house !== null) {
        // La fenêtre devient porte (conception 4.2): le mur percé remplace le mur plein, une fois.
        this.house.swapPiece(room.def.wall, this.library.instantiate(room.def.doorWall));
        room.swapped = true;
      }
    }
    // Sous le toit réparé, les meubles ne se voient que de l'intérieur: inutile de les dessiner.
    const roofed = done('house_roof') && !inside;
    this.updateFurniture(world.furniture, roofed, context);
    this.mergeStillFurniture(world.furniture);
    this.updateDecor(world.decor, roofed);
    this.updateGhosts(context);
    this.updateCorners(context, roofed);
  }

  /** Coin à soi de chaque joueur: un cadre discret au sol, à la couleur de son foulard, chez les deux joueurs. */
  private updateCorners(context: FrameContext, roofed: boolean): void {
    for (const character of context.world.characters) {
      const corner = character.corner ?? null;
      let view = this.corners.get(character.id);
      if (corner === null || roofed) {
        if (view !== undefined) view.mesh.visible = false;
        continue;
      }
      if (view === undefined) {
        const material = this.resources.track(
          new MeshBasicMaterial({
            map: this.materials.paletteTexture,
            transparent: true,
            opacity: CORNER_OPACITY,
            depthWrite: false,
          }),
        );
        const mesh = new Mesh(this.cornerFrame(), material);
        mesh.name = `coin ${character.id}`;
        mesh.renderOrder = 1;
        this.group.add(mesh);
        view = { mesh, material, color: '' };
        this.corners.set(character.id, view);
      }
      if (view.color !== character.appearance.scarf) {
        view.color = character.appearance.scarf;
        view.material.color.set(safeColor(character.appearance.scarf));
      }
      const x = corner.cx + CORNER_SIZE / 2;
      const y = corner.cy + CORNER_SIZE / 2;
      view.mesh.position.set(x, this.terrain.heightAt(x, y) + CORNER_LIFT, y);
      view.mesh.visible = true;
    }
  }

  private cornerFrame(): BufferGeometry {
    if (this.cornerGeometry === null) {
      const frame = new ShapeBuilder();
      const side = CORNER_SIZE - 2 * CORNER_INSET;
      const half = (side - CORNER_THICKNESS) / 2;
      for (const [x, z, w, d] of [
        [0, -half, side, CORNER_THICKNESS],
        [0, half, side, CORNER_THICKNESS],
        [-half, 0, CORNER_THICKNESS, side - 2 * CORNER_THICKNESS],
        [half, 0, CORNER_THICKNESS, side - 2 * CORNER_THICKNESS],
      ] as const) {
        frame.box([w, CORNER_HEIGHT, d], [x, 0, z], 'white_paint');
      }
      const peg = (side - CORNER_PEG_SIZE) / 2;
      for (const [x, z] of [
        [-peg, -peg],
        [peg, -peg],
        [-peg, peg],
        [peg, peg],
      ] as const) {
        frame.box([CORNER_PEG_SIZE, CORNER_PEG_HEIGHT, CORNER_PEG_SIZE], [x, 0, z], 'white_paint', {
          base: true,
        });
      }
      this.cornerGeometry = this.resources.track(frame.build());
    }
    return this.cornerGeometry;
  }

  private footprint(item: string, rotation: number): { w: number; d: number } {
    const size = this.content.items[item]?.footprint ?? this.modelFootprint(item);
    return rotation % 2 === 0 ? size : { w: size.d, d: size.w };
  }

  /**
   * Emprise lue dans le modèle (extra `footprint` [w, d]) pour un meuble absent de `objets.json`
   * (tour 10: le grand coffre, l'étagère haute du cellier, posés par la simulation).
   */
  private modelFootprint(item: string): { w: number; d: number } {
    const raw = this.library.extras(item).footprint;
    if (Array.isArray(raw) && typeof raw[0] === 'number' && typeof raw[1] === 'number') return { w: raw[0], d: raw[1] };
    return { w: 1, d: 1 };
  }

  /** Objet mural (`wall` de l'objet, sinon extra `wall` du modèle). */
  private isWallItem(item: string): boolean {
    const definition = this.content.items[item];
    if (definition !== undefined) return definition.wall;
    return this.library.extras(item).wall === true;
  }

  private place(object: Object3D, item: string, cx: number, cy: number, rotation: number): void {
    const size = this.footprint(item, rotation);
    const x = cx + size.w / 2;
    const y = cy + size.d / 2;
    object.position.set(x, this.terrain.heightAt(x, y), y);
    object.rotation.y = yawFromQuarter(rotation);
  }

  /** Fenêtres de la maisonnette (lues une fois dans le modèle, jamais dans une liste écrite à la main). */
  private readonly windows: Map<string, WindowSpec>;
  private readonly housePose = new Matrix4();
  private readonly houseYaw: number;

  /** Rideaux d'un article: la tringle et ses deux états (couleur de l'article, écru si inconnu). */
  private curtainModel(item: string): { object: Object3D; open: Object3D; closed: Object3D } | null {
    const states = (this.library.extras(CURTAIN_MODEL).states ?? {}) as Record<string, unknown>;
    const article = typeof states[item] === 'object' ? item : 'curtains';
    const names = states[article] as { open?: unknown; closed?: unknown } | undefined;
    const openName = typeof names?.open === 'string' ? names.open : `${article}_open`;
    const closedName = typeof names?.closed === 'string' ? names.closed : `${article}_closed`;
    if (!this.library.has(openName) || !this.library.has(closedName)) return null;
    const object = new Group();
    object.name = `rideaux ${item}`;
    const open = this.library.instantiate(openName);
    const closed = this.library.instantiate(closedName);
    object.add(open, closed);
    if (this.library.has(CURTAIN_ROD)) object.add(this.library.instantiate(CURTAIN_ROD));
    applyShadows(object);
    return { object, open, closed };
  }

  /**
   * Rideaux à leur fenêtre (conception 6.1): centrés, la pièce vers +Z du modèle, à l'échelle de la
   * fenêtre; cachés avec leur mur quand la coupe l'efface, et tant que leur pièce n'est pas bâtie.
   * Vus aussi du dehors, à travers la vitre.
   */
  private updateCurtain(view: FurnitureView, windowName: string, closed: boolean): void {
    const spec = this.windows.get(windowName);
    const curtain = view.curtain;
    if (spec === undefined || curtain === null) {
      view.object.visible = false;
      view.pick.enabled = false;
      return;
    }
    const room = WINDOW_ROOMS[spec.room];
    const built = room === undefined || roomStage(this.lastWorldRooms[room], this.lastDay) === 'built';
    view.object.position.copy(spec.centre).applyMatrix4(this.housePose);
    view.object.rotation.set(0, this.houseYaw + Math.atan2(spec.inward.x, spec.inward.z), 0);
    view.object.scale.set(spec.width / CURTAIN_SIZE.width, spec.height / CURTAIN_SIZE.height, 1);
    curtain.open.visible = !closed;
    curtain.closed.visible = closed;
    this.wallFacing.copy(spec.inward).negate().applyAxisAngle(this.up, this.houseYaw);
    view.object.visible = built && this.repairedNow && !this.wallCut(this.wallFacing);
    const half = Math.max(spec.width, 0.5) / 2;
    const p = view.object.position;
    view.pick.box.min.set(p.x - half, p.y - spec.height / 2, p.z - half);
    view.pick.box.max.set(p.x + half, p.y + spec.height / 2, p.z + half);
    view.pick.enabled = view.object.visible && this.cutInside;
  }

  /**
   * Outils du râtelier (`WorldState.rack`): pendus aux crochets du modèle (`hook_spots`), un tous
   * les `RACK_HOOK_STEP` crochets, par le bout du manche, tête en bas.
   */
  private dressRack(view: FurnitureView, rack: readonly DeepReadonly<ItemStack>[]): void {
    let key = '';
    for (const stack of rack) key += `${stack.item};`;
    if (view.rack?.key === key) return;
    for (const tool of view.rack?.tools ?? []) tool.removeFromParent();
    const hooks = this.library.extras(RACK_MODEL).hook_spots;
    const spots = Array.isArray(hooks) ? (hooks as unknown[]) : [];
    const tools: Object3D[] = [];
    rack.forEach((stack, index) => {
      const spot = spots[index * RACK_HOOK_STEP];
      if (!Array.isArray(spot)) return;
      const [x, y, z] = spot as unknown[];
      if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') return;
      const tool = this.library.instantiate(this.content.items[stack.item]?.model ?? stack.item);
      applyShadows(tool);
      tool.position.set(x, y - RACK_HANG_DROP, z + 0.04);
      view.object.add(tool);
      tools.push(tool);
    });
    view.rack = { key, tools };
  }

  private modelFor(item: string): Object3D {
    const definition = this.content.items[item];
    const size = definition?.footprint ?? { w: 1, d: 1 };
    const object = this.library.instantiate(definition?.model ?? item, {
      width: size.w,
      depth: size.d,
    });
    applyShadows(object);
    return object;
  }

  /** Meubles immobiles fusionnés (tour 10): leur empreinte et leur fusion. */
  private stillKey = Number.NaN;
  private stillMeshes: Mesh[] = [];
  private readonly stillObjects: Object3D[] = [];

  /**
   * Les meubles visibles qui ne bougent pas (ni horloge, ni gravure de saison, ni rideaux, ni
   * râtelier garni) fusionnés en un maillage par matériau: une pièce meublée coûte un appel au
   * lieu d'un par meuble. Refait quand un meuble est posé, déplacé, tourné, montré ou caché
   * (empreinte numérique, rien d'alloué tant que rien ne change).
   */
  private mergeStillFurniture(placed: readonly DeepReadonly<PlacedFurniture>[]): void {
    let key = 0;
    let count = 0;
    for (const piece of placed) {
      const view = this.furniture.get(piece.id);
      if (view === undefined || !this.isStill(view)) continue;
      key = (key * 31 + (view.object.visible ? 1 : 2)) | 0;
      for (let i = 0; i < piece.id.length; i += 1) key = (key * 31 + piece.id.charCodeAt(i)) | 0;
      key = (key * 31 + piece.cell.cx * 101 + piece.cell.cy * 7 + piece.rotation) | 0;
      if (view.object.visible) count += 1;
    }
    if (key !== this.stillKey) {
      this.stillKey = key;
      for (const mesh of this.stillMeshes) {
        mesh.removeFromParent();
        mesh.geometry.dispose();
      }
      this.stillMeshes = [];
      this.stillObjects.length = 0;
      for (const piece of placed) {
        const view = this.furniture.get(piece.id);
        if (view !== undefined && this.isStill(view) && view.object.visible) this.stillObjects.push(view.object);
      }
      if (count > 1) {
        this.group.updateMatrixWorld(true);
        this.stillMeshes = mergePieces(this.group, this.stillObjects, this.resources) ?? [];
        for (const mesh of this.stillMeshes) this.group.add(mesh);
      }
    }
    if (this.stillMeshes.length === 0) return;
    for (const object of this.stillObjects) object.visible = false;
    for (const mesh of this.stillMeshes) mesh.visible = true;
  }

  private isStill(view: FurnitureView): boolean {
    if (view.curtain !== null || (view.rack?.tools.length ?? 0) > 0) return false;
    const data = view.object.userData as { still?: boolean };
    data.still ??= view.object.getObjectByName('wall_clock_hour') === undefined && view.object.userData.seasons === undefined;
    return data.still;
  }

  private updateFurniture(placed: readonly DeepReadonly<PlacedFurniture>[], hidden: boolean, context: FrameContext): void {
    const seen = new Set<string>();
    for (const piece of placed) {
      seen.add(piece.id);
      let view = this.furniture.get(piece.id);
      const windowName = piece.window ?? null;
      if (view?.item !== piece.item || view.window !== windowName) {
        if (view !== undefined) {
          view.object.removeFromParent();
          this.picks.remove(view.pick);
        }
        const curtain = windowName === null ? null : this.curtainModel(piece.item);
        view = {
          item: piece.item,
          window: windowName,
          object: curtain?.object ?? this.modelFor(piece.item),
          curtain: curtain === null ? null : { open: curtain.open, closed: curtain.closed },
          pick: this.picks.add({ kind: 'furniture', furniture: piece.id }),
          rack: null,
        };
        this.group.add(view.object);
        this.furniture.set(piece.id, view);
      }
      if (view.curtain !== null && windowName !== null) {
        this.updateCurtain(view, windowName, piece.closed === true);
        continue;
      }
      const wall = this.isWallItem(piece.item);
      const rotation = wall ? this.wallRotation(piece.cell.cx, piece.cell.cy, piece.rotation) : piece.rotation;
      this.place(view.object, piece.item, piece.cell.cx, piece.cell.cy, rotation);
      // Un objet mural suit son mur: caché avec lui quand la coupe l'efface.
      this.wallFacing.set(Math.sin(yawFromQuarter(rotation)), 0, Math.cos(yawFromQuarter(rotation))).negate();
      view.object.visible = !hidden && !(wall && this.wallCut(this.wallFacing));
      if (view.object.visible) {
        dressFurniture(view.object, context, this.content);
        if (this.library.resolve(this.content.items[piece.item]?.model ?? piece.item) === RACK_MODEL) {
          this.dressRack(view, context.world.rack);
        }
      }
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

  /**
   * Hauteur (m, repère du modèle) du dessus d'un meuble à une place: un rayon tiré d'en haut sur la
   * géométrie du modèle (le plateau de la table à 0,78 m, le couvercle du coffre), une fois par place.
   * Le petit objet y pose sa base: ni flottant, ni enfoncé.
   */
  private topHeight(item: string, x: number, z: number): number {
    const model = this.content.items[item]?.model ?? item;
    const key = `${model}:${x}:${z}`;
    const known = this.topHeights.get(key);
    if (known !== undefined) return known;
    const probe = this.library.instantiate(model);
    probe.updateMatrixWorld(true);
    this.decorBox.setFromObject(probe);
    this.raycaster.set(this.probeFrom.set(x, this.decorBox.max.y + 1, z), DOWN);
    const hit = this.raycaster.intersectObject(probe, true)[0];
    const extra = this.library.extras(model).top_height;
    const height = hit?.point.y ?? (typeof extra === 'number' ? extra : this.decorBox.max.y);
    this.topHeights.set(key, height);
    return height;
  }

  /** Écrit dans `out` où poser un petit objet: la place `place` du dessus du meuble `host`. Faux sans meuble. */
  private decorSpot(hostId: string, place: number, out: Vector3): { yaw: number } | null {
    const host = this.furniture.get(hostId);
    const at = host === undefined ? undefined : this.content.items[host.item]?.surface[place];
    if (host === undefined || at === undefined) return null;
    const yaw = host.object.rotation.y;
    const h = this.topHeight(host.item, at.x, at.z);
    out.set(
      host.object.position.x + Math.cos(yaw) * at.x + Math.sin(yaw) * at.z,
      host.object.position.y + h,
      host.object.position.z - Math.sin(yaw) * at.x + Math.cos(yaw) * at.z,
    );
    return { yaw };
  }

  /** Petits objets posés sur les meubles (S03): sur le dessus de leur meuble, tournés comme lui. */
  private updateDecor(placed: readonly DeepReadonly<PlacedDecor>[], hidden: boolean): void {
    const seen = new Set<string>();
    for (const d of placed) {
      seen.add(d.id);
      let view = this.decor.get(d.id);
      if (view?.item !== d.item) {
        if (view !== undefined) {
          view.object.removeFromParent();
          this.picks.remove(view.pick);
        }
        view = { item: d.item, object: this.modelFor(d.item), pick: this.picks.add({ kind: 'furniture', furniture: d.id }) };
        this.group.add(view.object);
        this.decor.set(d.id, view);
      }
      const spot = this.decorSpot(d.on, d.place, this.decorPoint);
      const host = this.furniture.get(d.on);
      view.object.visible = spot !== null && !hidden && host !== undefined;
      view.pick.enabled = view.object.visible;
      if (spot === null) continue;
      view.object.position.copy(this.decorPoint);
      view.object.rotation.set(0, spot.yaw, 0);
      view.object.updateMatrixWorld(true);
      view.pick.box.setFromObject(view.object);
      view.pick.box.expandByScalar(DECOR_PICK_MARGIN);
    }
    for (const [id, view] of this.decor) {
      if (!seen.has(id)) {
        view.object.removeFromParent();
        this.picks.remove(view.pick);
        this.decor.delete(id);
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
      const on = preview.on;
      const spot = on === undefined ? null : this.decorSpot(on.furniture, on.place, this.tmp);
      if (spot !== null) {
        // Sur le dessus du meuble visé (S03), à la place même où il sera posé.
        ghost.object.position.copy(this.tmp);
        ghost.object.rotation.y = spot.yaw;
      } else this.place(ghost.object, preview.item, preview.cell.cx, preview.cell.cy, preview.rotation);
    }
  }

  /** Point de la maison (effets, poussière), dans le repère du monde. */
  houseCenter(): Vector3 {
    return this.house?.center() ?? this.tmp.set(this.map.house.room.x, 0, this.map.house.room.y);
  }

  dispose(): void {
    for (const room of this.rooms) room.view.dispose();
    this.house?.dispose();
    this.coop?.dispose();
    for (const view of this.furniture.values()) {
      this.picks.remove(view.pick);
    }
    this.furniture.clear();
    for (const view of this.decor.values()) this.picks.remove(view.pick);
    this.decor.clear();
    this.ghosts.clear();
    this.corners.clear();
    this.group.removeFromParent();
  }
}

/** Heures par tour de cadran et minutes par jour (horloge murale du tour 9). */
const DIAL_HOURS = 12;
const MINUTES_PER_HOUR = 60;
/** Balancier de l'horloge murale: amplitude (degrés) et battements par seconde (un tic-tac par seconde). */
const PENDULUM_DEGREES = 8;
const PENDULUM_HZ = 0.5;

/**
 * Ce qui bouge sur un objet de la maison (tour 9): les aiguilles de l'horloge à l'heure du jeu et
 * son balancier, la gravure du calendrier de la saison. Rien pour les autres objets.
 */
function dressFurniture(object: Object3D, context: FrameContext, content: Content): void {
  const hour = object.getObjectByName('wall_clock_hour');
  if (hour !== undefined) {
    const minutes = context.world.clock.minutes;
    hour.rotation.z = -((minutes / MINUTES_PER_HOUR) % DIAL_HOURS) / DIAL_HOURS * Math.PI * 2;
    const minute = object.getObjectByName('wall_clock_minute');
    if (minute !== undefined) minute.rotation.z = -((minutes % MINUTES_PER_HOUR) / MINUTES_PER_HOUR) * Math.PI * 2;
    const pendulum = object.getObjectByName('wall_clock_pendulum');
    if (pendulum !== undefined) {
      const swing = context.reducedMotion ? 0 : Math.sin(context.time * Math.PI * 2 * PENDULUM_HZ);
      pendulum.rotation.z = swing * PENDULUM_DEGREES * (Math.PI / 180);
    }
  }
  const seasons = object.userData.seasons as unknown;
  if (typeof seasons === 'object' && seasons !== null) {
    const byName = seasons as Record<string, unknown>;
    const shown = byName[seasonOfDay(content.settings, context.world.clock.day)];
    for (const key in byName) {
      const child = typeof byName[key] === 'string' ? object.getObjectByName(byName[key]) : undefined;
      if (child !== undefined) child.visible = child.name === shown;
    }
  }
}
