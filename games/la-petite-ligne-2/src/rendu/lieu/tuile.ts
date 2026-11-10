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
import type { OccluderBox } from '../occultation';
import { ResourceTracker } from '../ressources';
import { FadingMesh, GeometryBuilder } from './geometrie';
import type { TileSettings } from './reglages-tuiles';
import {
  type BlobItem,
  type BoxItem,
  type BuildingShape,
  type GroundField,
  hash01,
  railPieces,
  tileDecor,
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
}

/** Ce que toutes les tuiles d'un lieu partagent (créé et libéré par le lieu). */
export interface TileKit {
  readonly map: MapDef;
  readonly field: GroundField;
  readonly settings: TileSettings;
  readonly buildings: ReadonlyMap<number, readonly BuildingShape[]>;
  readonly materials: TileMaterials;
  readonly shapes: TileShapes;
}

const matrix = new Matrix4();
const position = new Vector3();
const rotation = new Quaternion();
const scale = new Vector3();
const up = new Vector3(0, 1, 0);
const color = new Color();
const corner = [new Color(), new Color(), new Color(), new Color()];

export class TileView {
  readonly group = new Group();
  readonly tracker = new ResourceTracker();
  readonly instanced: InstancedMesh[] = [];
  readonly fading: FadingMesh[] = [];
  readonly occluders: OccluderBox[] = [];
  /** Boîtes des houppiers (même index que `trees`). */
  readonly crownBoxes: OccluderBox[] = [];
  /** Houppiers (index d'instance = index dans `trees`), pour les effacer devant le joueur. */
  trees: readonly TreeItem[] = [];
  crowns: InstancedMesh | null = null;
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
      if ((object as Partial<Mesh>).isMesh === true) object.castShadow = cast;
    });
  }

  /** Parties effacées en ce moment (contrôle de fuite). */
  fadedCount(): number {
    let count = 0;
    for (const mesh of this.fading) count += mesh.fadedCount;
    return count;
  }

  dispose(): void {
    for (const mesh of this.fading) mesh.dispose();
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
  const at = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= width || y >= height ? -1 : (cells[y * width + x] ?? 0);
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const code = at(x, y);
      const look = looks[code];
      if (look === undefined || look.hidden === true) continue;
      if (look.water === true) {
        // Berges: une paroi de terre là où l'eau touche la terre ferme.
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
  for (const piece of railPieces(map, tile, settings)) builder.box(piece);
  return builder.build();
}

function waterOf(kit: TileKit, tile: number): BufferGeometry | null {
  const { field, settings, map } = kit;
  const { width, looks, cells } = field;
  const { x0, y0, x1, y1 } = tileRect(map, tile);
  const builder = new GeometryBuilder();
  const white = [color.set('#ffffff')];
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
    y: tree.trunkHeight + tree.crownHeight * 0.45,
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

  const ground = groundOf(kit, tile);
  if (ground !== null) {
    const mesh = new Mesh(view.tracker.track(ground), materials.ground);
    mesh.name = 'sol';
    mesh.receiveShadow = true;
    view.add(mesh);
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

  const decor = tileDecor(kit.field, kit.map, tile, kit.settings);
  view.trees = decor.trees;
  yield;
  instances(view, shapes.box, materials.instanced, decor.boxes.length, 'boites', (mesh, i) => {
    const item = decor.boxes[i];
    if (item !== undefined) putBox(mesh, i, item);
  });
  instances(view, shapes.trunk, materials.instanced, decor.trees.length, 'troncs', (mesh, i) => {
    const tree = decor.trees[i];
    if (tree === undefined) return;
    rotation.identity();
    matrix.compose(
      position.set(tree.x, 0, tree.z),
      rotation,
      scale.set(tree.trunkRadius, tree.trunkHeight + tree.crownHeight * 0.3, tree.trunkRadius),
    );
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, color.set(kit.settings.decor.trunkColor));
  });
  // Houppiers d'abord (index = index de l'arbre), buissons ensuite.
  view.crowns = instances(
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
    view.crownBoxes.push({
      id: String(i),
      min: { x: blob.x - blob.rx, y: blob.y - blob.ry, z: blob.z - blob.rz },
      max: { x: blob.x + blob.rx, y: blob.y + blob.ry, z: blob.z + blob.rz },
    });
  }
  yield;

  const buildings = kit.buildings.get(tile) ?? [];
  if (buildings.length > 0) {
    const walls = new GeometryBuilder();
    const glass = new GeometryBuilder();
    const roofs = new GeometryBuilder();
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
