/**
 * Une tuile de 32 m d'un grand lieu (ADR 0022): sol par nature de terrain (berges et rails
 * compris) en un maillage, eau animée, décor instancié (une instance par boîte, tronc, houppier),
 * bâtiments en trois maillages fusionnés (murs, vitres et lampes, toits), chacun effaçable par
 * bâtiment. Huit appels de dessin au plus par passe. Construite par étapes (`buildTile` est un
 * générateur) pour étaler le travail sur plusieurs images; tout ce qu'elle crée passe par son
 * `ResourceTracker`.
 */
import {
  type BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  type Material,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
} from 'three';
import type { MapDef } from '../../donnees/schemas/lieu';
import { KIND, LAYER, SWAP } from '../encre/couches';
import { SHADOW_ONLY } from '../encre/ombres';
import { Fadable } from '../fondu';
import type { OccluderBox } from '../occultation';
import { ResourceTracker } from '../ressources';
import { FadingMesh, GeometryBuilder } from './geometrie';
import {
  DECOR_MANIFEST,
  type DecorManifest,
  jitterOf,
  stateModel,
  variantOf,
} from './decors-manifeste';
import type { KeepOut } from './emprises';
import { HARVEST_LOOK, type HarvestLookSettings } from './reglages-recoltes';
import type { TileSettings } from './reglages-tuiles';
import type { Relief } from './relief';
import { reliefGround } from './relief-sol';
import {
  type BlobItem,
  type BoxItem,
  type BuildingShape,
  type GroundField,
  hash01,
  railPieces,
  type TileDecor,
  tileDecor,
  tileSemis,
  type TreeItem,
} from './terrain-rendu';
import { tileRect } from './tuiles';

export interface TileMaterials {
  readonly ground: Material;
  readonly water: Material;
  readonly instanced: Material;
  readonly glass: Material;
}

export interface TileShapes {
  /** Boîte unité posée sur y = 0, tronc (cylindre unité posé), boule unité centrée. */
  readonly box: BufferGeometry;
  readonly trunk: BufferGeometry;
  readonly blob: BufferGeometry;
  /** Rendu encré: caillou cabossé et touffe dressée du semis (absents de l'ancien rendu). */
  readonly pebble?: BufferGeometry;
  readonly tuft?: BufferGeometry;
}

/**
 * Modèles livrés de la végétation semée (rendu encré): géométrie fusionnée d'un modèle du
 * manifeste (`DecorModels.geometryOf`), posée en instances. Les géométries restent à la source.
 */
export interface TilePlants {
  geometryOf(model: string): BufferGeometry | null;
}

/** Une place de la végétation semée: le modèle tiré, sa pose, et l'arbre qu'elle montre. */
interface Planting {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly scale: number;
  /** Index dans `trees` (houppier effaçable), `null` pour un buisson. */
  readonly tree: number | null;
}

/** Ce que toutes les tuiles d'un lieu partagent (créé et libéré par le lieu). */
export interface TileKit {
  readonly map: MapDef;
  readonly field: GroundField;
  readonly settings: TileSettings;
  readonly buildings: ReadonlyMap<number, readonly BuildingShape[]>;
  /** Bâtiments livrés (rendu encré), par tuile: ils remplacent les volumes provisoires. */
  readonly models?: ReadonlyMap<number, readonly ModeledBuilding[]>;
  readonly materials: TileMaterials;
  readonly shapes: TileShapes;
  /** Relief du sol (rendu encré): le sol, le décor et le semis en suivent la hauteur; absent: sol plan. */
  readonly relief?: Relief | null;
  /** Rendu encré: arbres et buissons semés en modèles livrés; absent: troncs et boules. */
  readonly plants?: TilePlants | null;
  /** Choix des modèles semés et manifeste où les lire (par défaut ceux du jeu). */
  readonly look?: HarvestLookSettings;
  readonly manifest?: DecorManifest;
  /** Emprises où rien ne se sème (meubles, potagers, bâtiments, bords de chemin); absent: partout. */
  readonly keepOut?: KeepOut | null;
  /** Faux: les clôtures de la voie sont posées en modèles livrés par le lieu, pas en boîtes. */
  readonly fences?: boolean;
}

/** Végétation semée d'une tuile: ce qui se dessine, et ce qui en porte l'ombre sans se dessiner. */
interface Plantings {
  readonly shown: Map<string, { model: string; twinned: boolean; list: Planting[] }>;
  readonly casters: Map<string, { model: string; list: Planting[] }>;
}

/** L'instance qui montre un arbre (son houppier s'efface devant le joueur). */
export interface CrownSlot {
  readonly mesh: InstancedMesh;
  readonly slot: number;
  /** Teinte de la copie effacée (blanc: les couleurs du modèle). */
  readonly color: string;
}

const matrix = new Matrix4();
const position = new Vector3();
const rotation = new Quaternion();
const scale = new Vector3();
const up = new Vector3(0, 1, 0);
const color = new Color();
const corner = [new Color(), new Color(), new Color(), new Color()];

/** Un bâtiment livré posé dans une tuile: sa géométrie reste à la source des bâtiments. */
export interface ModeledBuilding {
  readonly id: string;
  readonly geometry: BufferGeometry;
  readonly height: number;
  readonly rect: { x: number; y: number; w: number; h: number };
}

const modelGlow = new Color(0, 0, 0);

export class TileView {
  readonly group = new Group();
  readonly tracker = new ResourceTracker();
  readonly instanced: InstancedMesh[] = [];
  readonly fading: FadingMesh[] = [];
  /** Bâtiments livrés de la tuile, effaçables d'un bloc (par l'identifiant de leurs murs). */
  readonly models = new Map<string, Fadable>();
  readonly occluders: OccluderBox[] = [];
  /** Boîtes des houppiers (même index que `trees`). */
  readonly crownBoxes: OccluderBox[] = [];
  /** Arbres semés, et l'instance qui montre chacun (même index), pour les effacer devant le joueur. */
  trees: readonly TreeItem[] = [];
  readonly crownSlots: CrownSlot[] = [];
  triangles = 0;
  calls = 0;

  constructor(readonly tile: number) {
    this.group.name = `tuile-${String(tile)}`;
  }

  add(mesh: Mesh, instances = 1): void {
    this.group.add(mesh);
    const geometry = mesh.geometry;
    const count = geometry.index?.count ?? geometry.getAttribute('position').count;
    this.triangles += (count / 3) * instances;
    this.calls += 1;
  }

  /** Ombres portées par cette tuile ou non (tuiles proches seulement). */
  setShadows(cast: boolean): void {
    this.group.traverse((object) => {
      // Le semis (cailloux, touffes) ne porte pas d'ombre: elle ne se verrait pas, et la passe
      // d'ombre redessinerait des milliers de petits volumes.
      // Le sol en relief non plus: quelques centimètres ne portent aucune ombre lisible.
      // Un arbre dont l'ombre est portée par sa version allégée n'en porte pas lui-même.
      if ((object as Partial<Mesh>).isMesh === true)
        object.castShadow =
          cast &&
          object.userData.semis !== true &&
          object.userData.ground !== true &&
          object.userData.shadowTwin !== true;
    });
  }

  /** Parties effacées en ce moment (contrôle de fuite). */
  fadedCount(): number {
    let count = 0;
    for (const mesh of this.fading) count += mesh.fadedCount;
    for (const model of this.models.values()) count += model.copies;
    return count;
  }

  dispose(): void {
    for (const mesh of this.fading) mesh.dispose();
    for (const model of this.models.values()) model.dispose();
    this.models.clear();
    // Libère les tampons d'instances; les géométries unité restent au lieu.
    for (const mesh of this.instanced) mesh.dispose();
    this.group.removeFromParent();
    this.group.clear();
    this.tracker.dispose();
  }
}

function groundOf(kit: TileKit, tile: number): BufferGeometry | null {
  const { field, settings, map } = kit;
  const g = settings.ground;
  const { width, height, names, looks, cells } = field;
  const { x0, y0, x1, y1 } = tileRect(map, tile);
  const builder = new GeometryBuilder();
  const bank = new Color(g.bankColor);
  const shade = (target: Color, base: Color, x: number, y: number): Color =>
    target.copy(base).multiplyScalar(1 + (hash01(x, y, 21) - 0.5) * 2 * g.noise);
  const base = new Color();
  // Encre: la teinte et la matière du sol se lisent dans la carte du sol du lieu.
  builder.setInk(LAYER.grass, KIND.ground);
  const at = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= width || y >= height ? -1 : (cells[y * width + x] ?? 0);
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const code = at(x, y);
      const look = looks[code];
      if (look === undefined || look.hidden === true) continue;
      if (look.water === true) {
        // Berges: une paroi de terre là où l'eau touche la terre ferme.
        builder.setInk(LAYER.dirt);
        const top = 0;
        const low = g.waterLevel - 0.04;
        const sides: [number, number, [number, number, number][], [number, number, number]][] = [
          [
            x,
            y - 1,
            [
              [x, top, y],
              [x, low, y],
              [x + 1, low, y],
              [x + 1, top, y],
            ],
            [0, 0, 1],
          ],
          [
            x,
            y + 1,
            [
              [x + 1, top, y + 1],
              [x + 1, low, y + 1],
              [x, low, y + 1],
              [x, top, y + 1],
            ],
            [0, 0, -1],
          ],
          [
            x - 1,
            y,
            [
              [x, top, y + 1],
              [x, low, y + 1],
              [x, low, y],
              [x, top, y],
            ],
            [1, 0, 0],
          ],
          [
            x + 1,
            y,
            [
              [x + 1, top, y],
              [x + 1, low, y],
              [x + 1, low, y + 1],
              [x + 1, top, y + 1],
            ],
            [-1, 0, 0],
          ],
        ];
        for (const [nx, ny, quad, normal] of sides) {
          const other = looks[at(nx, ny)];
          if (other === undefined || other.water === true || other.hidden === true) continue;
          builder.quad(quad, normal, [bank]);
        }
        builder.setInk(LAYER.grass, KIND.ground);
        continue;
      }
      base.set(look.color);
      if (look.verge !== undefined) {
        const name = names[code];
        const edge = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].some(
          (other) => other >= 0 && names[other] !== name && looks[other]?.verge === undefined,
        );
        if (edge) base.multiplyScalar(look.verge);
      }
      const [c0, c1, c2, c3] = corner as [Color, Color, Color, Color];
      builder.quad(
        [
          [x, 0, y],
          [x, 0, y + 1],
          [x + 1, 0, y + 1],
          [x + 1, 0, y],
        ],
        [0, 1, 0],
        [
          shade(c0, base, x, y),
          shade(c1, base, x, y + 1),
          shade(c2, base, x + 1, y + 1),
          shade(c3, base, x + 1, y),
        ],
      );
    }
  builder.setInk(LAYER.grain);
  for (const piece of railPieces(map, tile, settings)) builder.box(piece);
  return builder.build();
}

/** Pose une boîte du décor sur le sol en relief: son pied s'y enfonce un peu (rien ne flotte). */
function settle(relief: Relief, item: BoxItem): void {
  const h = relief.heightAt(item.x, item.z);
  if (item.base > 0) {
    item.base += h;
    return;
  }
  const bury = relief.settings.mesh.bury;
  item.base = h - bury;
  item.h += bury;
}

function waterOf(kit: TileKit, tile: number): BufferGeometry | null {
  const { field, settings, map } = kit;
  const { width, looks, cells } = field;
  const { x0, y0, x1, y1 } = tileRect(map, tile);
  const builder = new GeometryBuilder();
  const white = [color.set('#ffffff')];
  builder.setInk(LAYER.plain, KIND.water);
  const level = settings.ground.waterLevel;
  for (let y = y0; y < y1; y++) {
    let x = x0;
    while (x < x1) {
      if (looks[cells[y * width + x] ?? 0]?.water !== true) {
        x++;
        continue;
      }
      let end = x + 1;
      while (end < x1 && looks[cells[y * width + end] ?? 0]?.water === true) end++;
      builder.quad(
        [
          [x, level, y],
          [x, level, y + 1],
          [end, level, y + 1],
          [end, level, y],
        ],
        [0, 1, 0],
        white,
      );
      x = end;
    }
  }
  return builder.build();
}

function instances(
  view: TileView,
  geometry: BufferGeometry,
  material: Material,
  count: number,
  name: string,
  fill: (mesh: InstancedMesh, i: number) => void,
): InstancedMesh | null {
  if (count === 0) return null;
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = name;
  for (let i = 0; i < count; i++) fill(mesh, i);
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.receiveShadow = true;
  view.instanced.push(mesh);
  view.add(mesh, count);
  return mesh;
}

function putBox(mesh: InstancedMesh, i: number, item: BoxItem): void {
  rotation.setFromAxisAngle(up, item.yaw);
  matrix.compose(
    position.set(item.x, item.base, item.z),
    rotation,
    scale.set(item.w, item.h, item.d),
  );
  mesh.setMatrixAt(i, matrix);
  mesh.setColorAt(i, color.set(item.color).multiplyScalar(0.92 + hash01(i, item.x * 7, 31) * 0.16));
}

function putBlob(mesh: InstancedMesh, i: number, item: BlobItem): void {
  rotation.identity();
  matrix.compose(
    position.set(item.x, item.y, item.z),
    rotation,
    scale.set(item.rx, item.ry, item.rz),
  );
  mesh.setMatrixAt(i, matrix);
  mesh.setColorAt(i, color.set(item.color));
}

/** Boule d'un houppier (pour l'instance et pour sa copie effacée). */
export function crownBlob(tree: TreeItem): BlobItem {
  return {
    x: tree.x,
    y: (tree.ground ?? 0) + tree.trunkHeight + tree.crownHeight * 0.45,
    z: tree.z,
    rx: tree.crownRadius,
    ry: tree.crownHeight,
    rz: tree.crownRadius,
    color: tree.color,
  };
}

/** Construit la tuile par étapes: chaque `yield` rend la main au moteur (budget par image). */
export function* buildTile(kit: TileKit, tile: number): Generator<void, TileView> {
  const view = new TileView(tile);
  const { materials, shapes } = kit;

  const relief = kit.relief ?? null;
  if (relief === null) {
    const flat = groundOf(kit, tile);
    if (flat !== null) {
      const mesh = new Mesh(view.tracker.track(flat), materials.ground);
      mesh.name = 'sol';
      mesh.receiveShadow = true;
      view.add(mesh);
    }
  } else {
    // Le sol en relief va par morceaux: ceux qui sortent du champ ne sont pas dessinés.
    const { x0, y0, x1, y1 } = tileRect(kit.map, tile);
    const side = relief.settings.mesh.chunk;
    for (let cy = y0; cy < y1; cy += side)
      for (let cx = x0; cx < x1; cx += side) {
        const chunk = { x0: cx, y0: cy, x1: Math.min(x1, cx + side), y1: Math.min(y1, cy + side) };
        const shaped = yield* reliefGround(relief, chunk);
        if (shaped === null) continue;
        const mesh = new Mesh(view.tracker.track(shaped), materials.ground);
        mesh.name = 'sol';
        mesh.receiveShadow = true;
        mesh.userData.ground = true;
        view.add(mesh);
      }
  }
  yield;
  const water = waterOf(kit, tile);
  if (water !== null) {
    const mesh = new Mesh(view.tracker.track(water), materials.water);
    mesh.name = 'eau';
    mesh.receiveShadow = true;
    view.add(mesh);
  }
  yield;

  const decor = tileDecor(
    kit.field,
    kit.map,
    tile,
    kit.settings,
    kit.keepOut ?? null,
    kit.fences !== false,
  );
  if (relief !== null) {
    // Le sol en relief ne porte pas d'ombre: les rails rejoignent les traverses (boîtes
    // instanciées), qui en portent, sans appel de dessin de plus.
    decor.boxes.push(...railPieces(kit.map, tile, kit.settings));
    for (const item of decor.boxes) settle(relief, item);
    for (const tree of decor.trees) tree.ground = relief.heightAt(tree.x, tree.z);
    for (const bush of decor.bushes) bush.y += relief.heightAt(bush.x, bush.z);
  }
  view.trees = decor.trees;
  yield;
  instances(view, shapes.box, materials.instanced, decor.boxes.length, 'boites', (mesh, i) => {
    const item = decor.boxes[i];
    if (item !== undefined) putBox(mesh, i, item);
  });
  const planted =
    kit.plants === undefined || kit.plants === null ? null : plantings(kit, decor, tile);
  if (planted === null) trunksAndBlobs(kit, view, decor);
  else {
    // Un maillage instancié par modèle tiré et par morceau de tuile: un appel de dessin par forme,
    // quel que soit le nombre, et un bois hors du champ n'est pas dessiné.
    const pose = (mesh: InstancedMesh, i: number, item: Planting): void => {
      rotation.setFromAxisAngle(up, item.yaw);
      matrix.compose(position.set(item.x, item.y, item.z), rotation, scale.setScalar(item.scale));
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, color.set('#ffffff'));
    };
    for (const { model, twinned, list } of planted.shown.values()) {
      const geometry = kit.plants?.geometryOf(model) ?? null;
      if (geometry === null) continue;
      const shown = instances(
        view,
        geometry,
        materials.instanced,
        list.length,
        model,
        (mesh, i) => {
          const item = list[i];
          if (item === undefined) return;
          pose(mesh, i, item);
          if (item.tree === null) return;
          view.crownSlots[item.tree] = { mesh, slot: i, color: '#ffffff' };
          // Boîte du houppier: la largeur réelle du modèle tel qu'il est posé.
          const size = (kit.manifest ?? DECOR_MANIFEST).models[model]?.size;
          const half = (Math.max(size?.w ?? 2, size?.d ?? 2) * item.scale) / 2;
          view.crownBoxes[item.tree] = {
            id: String(item.tree),
            min: { x: item.x - half, y: item.y, z: item.z - half },
            max: { x: item.x + half, y: item.y + (size?.h ?? 4) * item.scale, z: item.z + half },
          };
        },
      );
      if (shown !== null && twinned) shown.userData.shadowTwin = true;
    }
    // L'ombre des arbres: leur version allégée aux mêmes places, jamais dessinée, rangée par
    // morceaux plus grands (la carte d'ombre couvre tout le disque vu: moins d'appels).
    for (const { model, list } of planted.casters.values()) {
      const geometry = kit.plants?.geometryOf(model) ?? null;
      if (geometry === null) continue;
      const twin = instances(
        view,
        geometry,
        materials.instanced,
        list.length,
        `${model}-ombre`,
        (mesh, i) => {
          const item = list[i];
          if (item !== undefined) pose(mesh, i, item);
        },
      );
      if (twin !== null) twin.userData[SHADOW_ONLY] = true;
    }
  }
  yield;

  if (shapes.pebble !== undefined && shapes.tuft !== undefined) {
    // Semis de petits volumes: ce qui ponctue le sol est un volume, pas un dessin à plat.
    const semis = tileSemis(kit.field, kit.map, tile, kit.settings, kit.keepOut ?? null);
    if (relief !== null) {
      for (const pebble of semis.pebbles) pebble.y += relief.heightAt(pebble.x, pebble.z);
      for (const tuft of semis.tufts) settle(relief, tuft);
    }
    const stones = instances(
      view,
      shapes.pebble,
      materials.instanced,
      semis.pebbles.length,
      'cailloux',
      (mesh, i) => {
        const item = semis.pebbles[i];
        if (item === undefined) return;
        putBlob(mesh, i, item);
        // Chaque caillou tourne sur lui-même: quatre facettes ne font pas deux fois la même pierre.
        rotation.setFromAxisAngle(up, hash01(i, tile, 81) * Math.PI * 2);
        matrix.compose(
          position.set(item.x, item.y, item.z),
          rotation,
          scale.set(item.rx, item.ry, item.rz),
        );
        mesh.setMatrixAt(i, matrix);
      },
    );
    const blades = instances(
      view,
      shapes.tuft,
      materials.instanced,
      semis.tufts.length,
      'touffes',
      (mesh, i) => {
        const item = semis.tufts[i];
        if (item !== undefined) putBox(mesh, i, item);
      },
    );
    for (const mesh of [stones, blades]) if (mesh !== null) mesh.userData.semis = true;
    yield;
  }

  for (const b of kit.models?.get(tile) ?? []) {
    // Posé au milieu de son emprise, rotation 0 (convention du manifeste des bâtiments).
    const mesh = new Mesh(b.geometry, materials.ground);
    mesh.name = b.id;
    mesh.position.set(b.rect.x + b.rect.w / 2, 0, b.rect.y + b.rect.h / 2);
    mesh.receiveShadow = true;
    view.add(mesh);
    const wallId = `${b.id}-murs`;
    view.models.set(wallId, new Fadable(mesh, modelGlow));
    view.occluders.push({
      id: wallId,
      min: { x: b.rect.x, y: 0, z: b.rect.y },
      max: { x: b.rect.x + b.rect.w, y: b.height, z: b.rect.y + b.rect.h },
    });
  }

  const buildings = kit.buildings.get(tile) ?? [];
  if (buildings.length > 0) {
    const walls = new GeometryBuilder();
    const glass = new GeometryBuilder();
    const roofs = new GeometryBuilder();
    walls.setInk(LAYER.wall);
    for (const b of buildings) {
      const wallId = `${b.id}-murs`;
      const roofId = `${b.id}-toit`;
      walls.begin(wallId);
      for (const box of b.walls) walls.box(box);
      walls.end();
      glass.begin(wallId);
      for (const box of b.glass) glass.box(box);
      glass.end();
      if (b.roof !== null) {
        roofs.begin(roofId);
        // Les rangs de tuiles courent le long du faîtage.
        roofs.setInk(LAYER.roof, b.roof.alongX ? 0 : SWAP);
        roofs.gable(b.roof);
        roofs.end();
        const o = kit.settings.building.overhang;
        view.occluders.push(
          {
            id: wallId,
            min: { x: b.rect.x, y: 0, z: b.rect.y },
            max: { x: b.rect.x + b.rect.w, y: b.wallHeight, z: b.rect.y + b.rect.h },
          },
          {
            id: roofId,
            min: { x: b.rect.x - o, y: b.wallHeight, z: b.rect.y - o },
            max: {
              x: b.rect.x + b.rect.w + o,
              y: b.wallHeight + b.roof.ridge,
              z: b.rect.y + b.rect.h + o,
            },
          },
        );
      }
    }
    const parts: [GeometryBuilder, Material, string][] = [
      [walls, materials.ground, 'murs'],
      [glass, materials.glass, 'vitres'],
      [roofs, materials.ground, 'toits'],
    ];
    for (const [builder, material, name] of parts) {
      const geometry = builder.build();
      if (geometry === null) continue;
      const fading = new FadingMesh(view.tracker.track(geometry), material, builder.ranges);
      fading.mesh.name = name;
      fading.mesh.receiveShadow = true;
      view.add(fading.mesh);
      view.fading.push(fading);
    }
  }
  return view;
}

/** Ancien décor semé (rendu en aplats, ou modèles absents): un tronc et une boule par arbre. */
function trunksAndBlobs(kit: TileKit, view: TileView, decor: TileDecor): void {
  const { materials, shapes } = kit;
  const relief = kit.relief ?? null;
  instances(view, shapes.trunk, materials.instanced, decor.trees.length, 'troncs', (mesh, i) => {
    const tree = decor.trees[i];
    if (tree === undefined) return;
    rotation.identity();
    // Le tronc part d'un peu sous le sol: sur une pente, son pied ne laisse pas de jour.
    const sunk = relief === null ? 0 : relief.settings.mesh.bury;
    matrix.compose(
      position.set(tree.x, (tree.ground ?? 0) - sunk, tree.z),
      rotation,
      scale.set(
        tree.trunkRadius,
        tree.trunkHeight + tree.crownHeight * 0.3 + sunk,
        tree.trunkRadius,
      ),
    );
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, color.set(kit.settings.decor.trunkColor));
  });
  // Houppiers d'abord (index = index de l'arbre), buissons ensuite.
  const crowns = instances(
    view,
    shapes.blob,
    materials.instanced,
    decor.trees.length + decor.bushes.length,
    'boules',
    (mesh, i) => {
      const tree = decor.trees[i];
      const item = tree !== undefined ? crownBlob(tree) : decor.bushes[i - decor.trees.length];
      if (item !== undefined) putBlob(mesh, i, item);
    },
  );
  for (const [i, tree] of decor.trees.entries()) {
    const blob = crownBlob(tree);
    if (crowns !== null) view.crownSlots.push({ mesh: crowns, slot: i, color: tree.color });
    view.crownBoxes.push({
      id: String(i),
      min: { x: blob.x - blob.rx, y: blob.y - blob.ry, z: blob.z - blob.rz },
      max: { x: blob.x + blob.rx, y: blob.y + blob.ry, z: blob.z + blob.rz },
    });
  }
}

function pick<T>(list: readonly T[], t: number): T | undefined {
  return list[Math.min(list.length - 1, Math.floor(t * list.length))];
}

/**
 * Végétation semée en modèles livrés: pour chaque arbre et buisson du décor, une essence tirée de
 * sa place (`look.semis`), puis sa variante, son cap et sa taille (`variantOf`, `jitterOf`): la
 * même forme à chaque chargement de la tuile et chez les deux joueurs. Rangée par morceau de
 * tuile (`semis.chunk`) et par modèle. Loin du couloir de jeu (`semis.light.beyond`), un arbre prend
 * sa version allégée; l'ombre de tous est portée par cette version (`casters`, `shadowChunk`).
 * `null`: une essence manque au manifeste ou à la source (le moteur garde troncs et boules).
 */
function plantings(kit: TileKit, decor: TileDecor, tile: number): Plantings | null {
  const look = kit.look ?? HARVEST_LOOK;
  const manifest = kit.manifest ?? DECOR_MANIFEST;
  const { x0, y0 } = tileRect(kit.map, tile);
  const side = look.semis.chunk;
  const out: Plantings = { shown: new Map(), casters: new Map() };
  const light = look.semis.light;
  const chunkOf = (x: number, z: number, size: number): string =>
    `${String(Math.floor((x - x0) / size))}:${String(Math.floor((z - y0) / size))}`;
  const place = (
    choices: readonly string[],
    x: number,
    y: number,
    z: number,
    size: number,
    tree: number | null,
    away = 0,
  ): boolean => {
    const essence = pick(choices, hash01(Math.floor(x * 10), Math.floor(z * 10), 41));
    if (essence === undefined || manifest.models[essence] === undefined) return false;
    const key = `semis:${String(Math.round(x * 100))}:${String(Math.round(z * 100))}`;
    const whole = variantOf(essence, key, manifest);
    if (kit.plants?.geometryOf(whole) === null) return false;
    // La version allégée de cette forme, si elle est livrée et chargée.
    const far = light === null ? null : stateModel(whole, light.state, manifest);
    const slim = far !== null && kit.plants?.geometryOf(far) !== null ? far : null;
    // Au fond du bois, la forme allégée de l'essence elle-même si une seule suffit (`variants`).
    const base =
      light === null || light.variants ? null : stateModel(essence, light.state, manifest);
    const deep = base !== null && kit.plants?.geometryOf(base) !== null ? base : slim;
    const model = deep !== null && light !== null && away > light.beyond ? deep : whole;
    // Qui porte son ombre: près du couloir, sa version allégée (un peu rétrécie sous l'arbre
    // entier); au fond du bois, la forme d'ombre de l'essence, sinon lui-même.
    const shadeState = light?.deepShadow ?? null;
    const shade = shadeState === null ? null : stateModel(essence, shadeState, manifest);
    const deepCaster = shade !== null && kit.plants?.geometryOf(shade) !== null ? shade : model;
    const caster = light?.shadow !== true ? null : model === whole ? slim : deepCaster;
    const { yaw, scale } = jitterOf(essence, key, manifest);
    const posed = { x, y, z, yaw, scale: scale * size, tree };
    const shownKey = `${chunkOf(x, z, side)}|${model}`;
    const group = out.shown.get(shownKey) ?? { model, twinned: caster !== null, list: [] };
    group.list.push(posed);
    out.shown.set(shownKey, group);
    if (caster !== null && light !== null) {
      const casterKey = `${chunkOf(x, z, light.shadowChunk)}|${caster}`;
      const twins = out.casters.get(casterKey) ?? { model: caster, list: [] };
      twins.list.push(
        model === whole ? { ...posed, scale: posed.scale * light.shadowShrink } : posed,
      );
      out.casters.set(casterKey, twins);
    }
    return true;
  };
  for (const [i, tree] of decor.trees.entries()) {
    // La taille tirée par le décor (0,75 à 1,35) reste, resserrée autour de celle du modèle.
    const size = 0.8 + ((tree.trunkHeight / 1.7 - 0.75) / 0.6) * 0.4;
    if (!place(look.semis.trees, tree.x, tree.ground ?? 0, tree.z, size, i, tree.away ?? 0))
      return null;
  }
  for (const bush of decor.bushes) {
    // Le pied du buisson: le bas de sa boule (posée sur le sol, relief compris).
    const size = 0.8 + bush.rx * 0.6;
    if (!place(look.semis.bushes, bush.x, bush.y - bush.ry * 0.875, bush.z, size, null))
      return null;
  }
  return out;
}
