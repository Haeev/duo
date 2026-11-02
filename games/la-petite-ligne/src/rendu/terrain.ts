/**
 * Terrain d'après la grille de la carte: un seul maillage pour tous les sols
 * (texture palette, un appel de dessin), avec des marches propres là où deux
 * sols n'ont pas la même hauteur (traversées, sols posés), le lit de la
 * rivière en pentes douces (`riviere.ts`), l'eau animée, et une bande
 * prolongée au-delà du bord pour ne jamais voir le vide (la rivière, la voie
 * et les chemins continuent; la forêt du pourtour pousse dans `vegetation.ts`).
 */
import {
  BufferAttribute,
  BufferGeometry,
  Euler,
  Group,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
} from 'three';
import type { GameMap, GroundKind, MapCrossing, MapProp } from '../etat/carte';
import { cellIndex, inRect } from '../etat/carte';
import { valueNoise, hash2 } from './bruit';
import { isFord } from './champs';
import { layFordStones } from './gue';
import { ShapeBuilder } from './geometrie';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SharedMaterials } from './materiaux';
import { paletteUv, type PaletteCell } from './palette';
import { RENDER_SETTINGS } from './reglages';
import { AMBIANCE_SETTINGS } from './reglages-ambiance';
import type { ResourceTracker } from './ressources';
import {
  createRiverField,
  riverTexture,
  type RiverCell,
  type RiverField,
  type RiverStone,
} from './riviere';
import { isStreamCell, streamHeight, streamLayout, type StreamLayout } from './ru';

const SETTINGS = RENDER_SETTINGS.terrain;
const NOISE_SEED_GRASS = 1;
const NOISE_SEED_PATH = 2;
const DARK_GRASS_BELOW = 0.36;
const LIGHT_GRASS_ABOVE = 0.68;
const PATH_DARK_ABOVE = 0.62;
const COBBLE_DARK_CHANCE = 0.3;
/** Vers où regarde chaque côté d'une case: est, ouest, sud, nord. */
const SIDES = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
] as const;

const CROSSING = SETTINGS.crossing;

/**
 * Une traversée en planches de la voie (cases `wood` voisines): repère local
 * `u` le long des rails, `v` en travers depuis l'axe de la voie. `alongX`: les
 * rails vont d'ouest en est (`u` = x, `v` = y - axe), sinon du nord au sud.
 */
interface Crossing {
  alongX: boolean;
  /** Axe de la voie, en x ou en y selon le sens. */
  axis: number;
  /** Étendue le long des rails (bords des cases): la largeur de la route. */
  u0: number;
  u1: number;
  /** Bord du platelage de chaque côté (v < 0, puis v > 0), en valeur absolue. */
  deck: [number, number];
  /** Rampe de chaque côté: hauteur de la route au pied, ou `null` (pas de rampe: voisin plus haut, le quai). */
  rampFoot: [number | null, number | null];
}

/** Ce que le rendu sait d'une case (y compris dans la bande prolongée). */
interface CellLook {
  kind: GroundKind;
  /** Eau franchissable (gué). */
  ford: boolean;
  height: number;
}

class GeometryWriter {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly uvs: number[] = [];
  private readonly a = new Vector3();
  private readonly b = new Vector3();
  private readonly n = new Vector3();

  /** Quadrilatère a, b, c, d (dans l'ordre du pourtour), orienté vers `normal`. */
  quad(
    points: readonly (readonly [number, number, number])[],
    normal: readonly [number, number, number],
    cell: PaletteCell,
  ): void {
    const [p0, p1, p2, p3] = points;
    if (p0 === undefined || p1 === undefined || p2 === undefined || p3 === undefined) {
      return;
    }
    this.a.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
    this.b.set(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]);
    this.n.crossVectors(this.a, this.b);
    const facing = this.n.x * normal[0] + this.n.y * normal[1] + this.n.z * normal[2];
    const order = facing >= 0 ? [p0, p1, p2, p0, p2, p3] : [p0, p2, p1, p0, p3, p2];
    const uv = paletteUv(cell);
    for (const p of order) {
      this.positions.push(p[0], p[1], p[2]);
      this.normals.push(normal[0], normal[1], normal[2]);
      this.uvs.push(uv.u, uv.v);
    }
  }

  /** Triangle a, b, c, orienté vers `normal`. */
  triangle(
    p0: readonly [number, number, number],
    p1: readonly [number, number, number],
    p2: readonly [number, number, number],
    normal: readonly [number, number, number],
    cell: PaletteCell,
  ): void {
    this.a.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
    this.b.set(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]);
    this.n.crossVectors(this.a, this.b);
    const facing = this.n.x * normal[0] + this.n.y * normal[1] + this.n.z * normal[2];
    const order = facing >= 0 ? [p0, p1, p2] : [p0, p2, p1];
    const uv = paletteUv(cell);
    for (const p of order) {
      this.positions.push(p[0], p[1], p[2]);
      this.normals.push(normal[0], normal[1], normal[2]);
      this.uvs.push(uv.u, uv.v);
    }
  }

  /**
   * Triangle a, b, c aux normales par sommet (pentes douces du lit de la
   * rivière), tourné vers le haut.
   */
  smoothTriangle(
    points: readonly (readonly [number, number, number])[],
    normals: readonly (readonly [number, number, number])[],
    cell: PaletteCell,
  ): void {
    const [p0, p1, p2] = points;
    const [n0, n1, n2] = normals;
    if (
      p0 === undefined ||
      p1 === undefined ||
      p2 === undefined ||
      n0 === undefined ||
      n1 === undefined ||
      n2 === undefined
    ) {
      return;
    }
    this.a.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
    this.b.set(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]);
    this.n.crossVectors(this.a, this.b);
    const order: [number, number, number] = this.n.y >= 0 ? [0, 1, 2] : [0, 2, 1];
    const uv = paletteUv(cell);
    for (const index of order) {
      const p = points[index];
      const normal = normals[index];
      if (p === undefined || normal === undefined) {
        continue;
      }
      this.positions.push(p[0], p[1], p[2]);
      this.normals.push(normal[0], normal[1], normal[2]);
      this.uvs.push(uv.u, uv.v);
    }
  }

  build(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(this.positions), 3));
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array(this.normals), 3));
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(this.uvs), 2));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }
}

/**
 * Sols dont les coins s'arrondissent entre eux: herbe, chemins, pavés de la
 * place (écart de hauteur d'au plus `cornerMaxStep`). Le gravier des berges et
 * du gué appartient au lit de la rivière, qui dessine ses propres bords.
 */
const ROUNDED_KINDS: ReadonlySet<GroundKind> = new Set<GroundKind>(['grass', 'path', 'stone']);
/** Teinte du lit de la rivière (le shader des surfaces le peint: sable, galets, fond). */
const RIVER_BED_CELL: PaletteCell = 'sand';
/** Écart de hauteur (m) sous lequel une case du lit est plate (un seul quadrilatère). */
const FLAT_EPSILON = 1e-4;
const SEED_RIVER_STONE = 131;
const SEED_REED = 151;
const SEED_STREAM_STONE = 171;
/** Rangées du ru avant l'embouchure vues comme de l'eau par le champ de la rivière. */
const STREAM_MOUTH_ROWS = 2;
const RIVER_STONE_CELLS: readonly PaletteCell[] = ['rock', 'rock_light', 'rock_dark', 'rock'];
const REED_CELLS: readonly PaletteCell[] = ['grass_dark', 'moss', 'grass_dark', 'grass_dry'];
/** Coins d'une case, dans l'ordre du pourtour: direction (sx, sy) vers le coin. */
const CORNERS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
] as const;

/** Sol prolongé au-delà du bord: on garde ce qui continue (eau, voie, chemin), le reste devient herbe. */
function extendedKind(kind: GroundKind): GroundKind {
  switch (kind) {
    case 'water':
    case 'rail':
    case 'path':
    case 'gravel':
      return kind;
    case 'grass':
    case 'dirt':
    case 'wood':
    case 'floor':
    case 'stone':
      return 'grass';
  }
}

export class Terrain {
  readonly group = new Group();
  /**
   * Surface de la rivière en morceaux de `surfaceChunk` m (point d'accroche du technical artist:
   * matériau d'eau), éliminés hors du cadre: aucun maillage ne grandit avec la carte (ADR 0016).
   */
  readonly water: Mesh[] = [];
  /** Surface du ru de la Côte, en morceaux (même programme que la rivière, courant vers le sud). */
  readonly streamWater: Mesh[] = [];
  private readonly ext = SETTINGS.extension;
  private readonly floorRects: { x: number; y: number; w: number; h: number; height: number }[] =
    [];
  private readonly crossings: Crossing[] = [];
  /** Le ru de la Côte (`ru.ts`), `null` sur une carte sans ru. */
  readonly stream: StreamLayout | null;

  /**
   * `floorHeight`: hauteur de marche d'un sol posé (quai, ponton), lue dans les
   * données de l'artiste quand elles existent; `crossingHeight`: celle d'un
   * ouvrage du ru (pont, passerelle, gué de pierres).
   */
  constructor(
    private readonly map: GameMap,
    materials: SharedMaterials,
    resources: ResourceTracker,
    floorHeight: (prop: MapProp) => number | undefined = (prop) =>
      RENDER_SETTINGS.floorProps[prop.model],
    crossingHeight: (crossing: MapCrossing) => number | undefined = () => undefined,
  ) {
    this.group.name = 'terrain';
    this.stream = streamLayout(map, this.ext);
    for (let cy = 0; cy < map.height; cy += 1) {
      for (let cx = 0; cx < map.width; cx += 1) {
        if (isFord(map, cx, cy) && !isStreamCell(this.stream, cx, cy)) {
          this.fords.add(cellIndex(map, cx, cy));
        }
      }
    }
    for (const prop of map.props) {
      const height = floorHeight(prop);
      if (height !== undefined && prop.rect !== null) {
        this.floorRects.push({ ...prop.rect, height });
      }
    }
    for (const crossing of map.crossings) {
      const height = crossingHeight(crossing);
      // Le ponceau ne porte rien: on marche sur le remblai de la voie.
      if (height !== undefined && crossing.kind !== 'culvert') {
        this.floorRects.push({ ...crossing.rect, height });
      }
    }
    this.findCrossings();
    this.river = this.buildRiverField();
    // Sol et creux du ru: même matériau, mêmes morceaux de `surfaceChunk` m. Le lit de la rivière
    // (berges quadrillées, pierres, roseaux: dense) garde ses tronçons de `stripSegment` m: dans
    // les morceaux du sol, la vue de la place gagnait 10 000 triangles pour 5 appels de moins.
    const writers = new Map<string, GeometryWriter>();
    const pieces = new Map<string, BufferGeometry[]>();
    const keyOf = (x: number, y: number, river: boolean): string =>
      river ? `lit ${Math.floor((x + this.ext) / SETTINGS.stripSegment)}` : this.chunkOf(x, y);
    const writerFor = (river: boolean) => (x: number, y: number): GeometryWriter => {
      const key = keyOf(x, y, river);
      let writer = writers.get(key);
      if (writer === undefined) {
        writer = new GeometryWriter();
        writers.set(key, writer);
      }
      return writer;
    };
    const pieceFor = (river: boolean) => (x: number, y: number, geometry: BufferGeometry): void => {
      const key = keyOf(x, y, river);
      const list = pieces.get(key);
      if (list === undefined) pieces.set(key, [geometry]);
      else list.push(geometry);
    };
    this.buildGround(writerFor(false));
    const stones = this.buildRiver(writerFor(true), pieceFor(true));
    this.buildStreamBed(writerFor(false), pieceFor(false));
    for (const key of new Set([...writers.keys(), ...pieces.keys()])) {
      const writer = writers.get(key);
      const parts = [...(pieces.get(key) ?? [])];
      if (writer !== undefined && writer.positions.length > 0) parts.unshift(writer.build());
      if (parts.length === 0) continue;
      const merged = parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
      for (const part of parts) {
        if (part !== merged) part.dispose();
      }
      if (merged === undefined) continue;
      merged.computeBoundingSphere();
      const ground = new Mesh(resources.track(merged), materials.palette);
      ground.name = key.startsWith('lit ') ? `${key} de la riviere` : `sol ${key}`;
      ground.receiveShadow = true;
      ground.matrixAutoUpdate = false;
      this.group.add(ground);
    }
    for (const [key, geometry] of this.buildWater()) {
      const water = new Mesh(resources.track(geometry), materials.water);
      water.name = `eau ${key}`;
      water.receiveShadow = true;
      water.matrixAutoUpdate = false;
      water.renderOrder = 1;
      this.water.push(water);
      this.group.add(water);
    }
    const outer = new Mesh(resources.track(this.buildOuterRing()), materials.palette);
    outer.name = 'pourtour';
    outer.receiveShadow = true;
    outer.matrixAutoUpdate = false;
    this.group.add(outer);
    this.buildStreamWater(materials, resources);
    this.river.texture = resources.track(riverTexture(this.river, stones));
  }

  /** Clé du morceau de `surfaceChunk` m qui contient le point (bande prolongée comprise). */
  private chunkOf(x: number, y: number): string {
    const size = SETTINGS.surfaceChunk;
    return `${Math.floor((x + this.ext) / size)}:${Math.floor((y + this.ext) / size)}`;
  }

  /** Vrai si la case est creusée par le ru. */
  isStream(cx: number, cy: number): boolean {
    return isStreamCell(this.stream, cx, cy);
  }

  /** Cases du gué (gravier entre deux bras d'eau): haut-fond de galets sous l'eau. */
  private readonly fords = new Set<number>();
  /** Lit de la rivière: forme des berges et du gué, texture des shaders (sol et eau). */
  readonly river: RiverField;

  /** Ce qu'est une case pour le lit de la rivière (bande prolongée comprise). */
  private riverCell(cx: number, cy: number): RiverCell {
    if (!this.insideBand(cx, cy)) {
      return 'land';
    }
    if (this.isStream(cx, cy)) {
      // Le ru sur la grève (deux rangées avant l'embouchure) compte comme de l'eau pour le champ
      // de la rivière: la ligne d'eau suit le ru jusqu'à elle, sans mur de sable entre les deux.
      // Plus haut, c'est de la terre (le creux est dessiné par le ru lui-même).
      const mouth = this.stream?.mouthY ?? 0;
      return cy >= mouth - STREAM_MOUTH_ROWS ? 'water' : 'land';
    }
    const look = this.look(cx, cy);
    if (look.ford) {
      return 'ford';
    }
    if (look.kind === 'water') {
      return 'water';
    }
    if (look.kind === 'gravel') {
      return 'bank';
    }
    // Un chemin qui longe la grève (promenade, R22): le sable va jusqu'à lui, sans liseré d'herbe.
    return look.kind === 'path' ? 'path' : 'land';
  }

  /** Vrai si la case appartient au lit de la rivière (eau, gué, berge), dessiné à part. */
  private inRiverBed(cx: number, cy: number): boolean {
    if (this.isStream(cx, cy)) return false;
    const cell = this.riverCell(cx, cy);
    return cell !== 'land' && cell !== 'path';
  }

  /** Lit de la rivière sur les rangées qui en contiennent (toute la largeur de la bande). */
  private buildRiverField(): RiverField {
    let y0 = Number.POSITIVE_INFINITY;
    let y1 = Number.NEGATIVE_INFINITY;
    for (let cy = -this.ext; cy < this.map.height + this.ext; cy += 1) {
      for (let cx = -this.ext; cx < this.map.width + this.ext; cx += 1) {
        if (this.inRiverBed(cx, cy)) {
          y0 = Math.min(y0, cy);
          y1 = Math.max(y1, cy + 1);
          break;
        }
      }
    }
    if (!Number.isFinite(y0)) {
      // Carte sans rivière: une grille minuscule, jamais lue.
      y0 = 0;
      y1 = 1;
    }
    return createRiverField(
      (cx, cy) => this.riverCell(cx, cy),
      -this.ext,
      this.map.width + this.ext,
      y0,
      y1,
    );
  }

  /** Hauteur dessinée du lit sous un point (berge, gué, fond), ou celle de la case hors du lit. */
  private bedHeight(x: number, y: number): number {
    return this.river.bedAt(x, y) ?? this.look(Math.floor(x), Math.floor(y)).height;
  }

  /**
   * Lit de la rivière, dans les morceaux du sol (éliminés hors du cadre): pentes
   * des berges et fond, pierres plates du gué, pierres rondes des rives, roseaux.
   * Renvoie les pierres qui affleurent, autour desquelles le courant s'ouvre.
   */
  private buildRiver(
    writerAt: (x: number, y: number) => GeometryWriter,
    addPiece: (x: number, y: number, geometry: BufferGeometry) => void,
  ): RiverStone[] {
    this.buildRiverBed((cx, cy) => writerAt(cx + 0.5, cy + 0.5));
    const builders = new Map<string, { builder: ShapeBuilder; x: number; y: number }>();
    const builderAt = (x: number, y: number): ShapeBuilder => {
      const key = this.chunkOf(x, y);
      let entry = builders.get(key);
      if (entry === undefined) {
        entry = { builder: new ShapeBuilder(), x, y };
        builders.set(key, entry);
      }
      return entry.builder;
    };
    const surfacing = this.placeFordStones(addPiece);
    this.bankStones(builderAt);
    this.reeds(builderAt);
    for (const { builder, x, y } of builders.values()) {
      if (!builder.isEmpty) addPiece(x, y, builder.build());
    }
    return surfacing;
  }

  /**
   * Pierres plates du gué (`gue.ts`): ligne de passage d'un chemin à l'autre,
   * pierres dispersées autour. Chacune part dans son tronçon par `add`;
   * renvoie l'emprise de celles qui crèvent la surface, pour le courant.
   */
  private placeFordStones(add: (x: number, y: number, geometry: BufferGeometry) => void): RiverStone[] {
    const stones = SETTINGS.fordStones;
    const shapes = new Map(
      stones.sides.map((sides) => [
        sides,
        new ShapeBuilder()
          .cylinder(0.5, 0.5, stones.thickness, [0, 0, 0], 'cobble_dark', {
            base: true,
            segments: sides,
          })
          .build(),
      ]),
    );
    const matrix = new Matrix4();
    const position = new Vector3();
    const rotation = new Quaternion();
    const euler = new Euler();
    const scale = new Vector3();
    const surfacing: RiverStone[] = [];
    const cells = [...this.fords].map((index) => ({
      cx: index % this.map.width,
      cy: Math.floor(index / this.map.width),
    }));
    const downstream = Math.sign(AMBIANCE_SETTINGS.water.flow[0]) || 1;
    for (const stone of layFordStones(this.map, cells, downstream)) {
      const shape = shapes.get(stone.sides);
      if (shape === undefined) {
        continue;
      }
      // Dessus à `protrude` au-dessus de la surface (posées sur le haut-fond), ou juste dessous.
      const top =
        stone.kind === 'flush'
          ? SETTINGS.waterSurface - stones.flushBelow
          : SETTINGS.waterSurface + stones.protrude;
      position.set(stone.x, top - stones.thickness, stone.y);
      rotation.setFromEuler(euler.set(0, stone.rotation, 0));
      scale.set(stone.size, 1, stone.size * stone.depth);
      add(stone.x, stone.y, shape.clone().applyMatrix4(matrix.compose(position, rotation, scale)));
      if (stone.kind !== 'flush') {
        surfacing.push({ x: stone.x, y: stone.y, radius: (stone.size * (1 + stone.depth)) / 4 });
      }
    }
    for (const shape of shapes.values()) {
      shape.dispose();
    }
    return surfacing;
  }

  /**
   * Points de la ligne d'eau (nœuds du lit au-dessus de la surface dont un
   * voisin est dessous), un au plus par carré de `spacing` m, dans l'ordre de la grille.
   */
  private shorePoints(spacing: number): { x: number; y: number }[] {
    const { bed, width, height, step, originX, originY } = this.river;
    const level = SETTINGS.waterSurface;
    const seen = new Set<string>();
    const out: { x: number; y: number }[] = [];
    for (let j = 1; j < height - 1; j += 1) {
      for (let i = 1; i < width - 1; i += 1) {
        const h = bed[j * width + i] ?? 0;
        if (h < level) {
          continue;
        }
        const below = [
          bed[j * width + i + 1],
          bed[j * width + i - 1],
          bed[(j + 1) * width + i],
          bed[(j - 1) * width + i],
        ].some((v) => v !== undefined && v < level);
        if (!below) {
          continue;
        }
        const x = originX + i * step;
        const y = originY + j * step;
        const key = `${Math.floor(x / spacing)}:${Math.floor(y / spacing)}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ x, y });
        }
      }
    }
    return out;
  }

  /** Vrai si un point de la rive est assez loin du gué et des sols posés (on y passe). */
  private shoreClear(x: number, y: number, clearance: number): boolean {
    const margin = SETTINGS.river.stones.margin;
    if (x < -margin || y < -margin || x > this.map.width + margin || y > this.map.height + margin) {
      return false;
    }
    for (const rect of this.floorRects) {
      const dx = Math.max(rect.x - x, 0, x - (rect.x + rect.w));
      const dy = Math.max(rect.y - y, 0, y - (rect.y + rect.h));
      if (Math.hypot(dx, dy) < clearance) {
        return false;
      }
    }
    for (const index of this.fords) {
      const cx = index % this.map.width;
      const cy = Math.floor(index / this.map.width);
      const dx = Math.max(cx - x, 0, x - (cx + 1));
      const dy = Math.max(cy - y, 0, y - (cy + 1));
      if (Math.hypot(dx, dy) < clearance) {
        return false;
      }
    }
    return true;
  }

  /** Pente du lit au point: direction (unitaire) vers où il monte. */
  private uphill(x: number, y: number): [number, number] {
    const e = this.river.step;
    const gx = this.bedHeight(x + e, y) - this.bedHeight(x - e, y);
    const gy = this.bedHeight(x, y + e) - this.bedHeight(x, y - e);
    const length = Math.hypot(gx, gy);
    return length > 1e-6 ? [gx / length, gy / length] : [0, -1];
  }

  /**
   * Pierres rondes des rives (bible, 8.7): un rang au ras de l'eau, à demi
   * noyé, et un rang de plus petites un peu plus haut sur la pente.
   */
  private bankStones(builderAt: (x: number, y: number) => ShapeBuilder): void {
    const s = SETTINGS.river.stones;
    const level = SETTINGS.waterSurface;
    for (const { x, y } of this.shorePoints(s.spacing)) {
      if (!this.shoreClear(x, y, s.clearance)) {
        continue;
      }
      const qx = Math.round(x * 8);
      const qy = Math.round(y * 8);
      const pick = <T>(list: readonly T[], seed: number): T | undefined =>
        list[Math.floor(hash2(qx, qy, seed) * list.length)];
      if (hash2(qx, qy, SEED_RIVER_STONE) < s.lowChance) {
        const size = s.lowSize[0] + hash2(qx, qy, SEED_RIVER_STONE + 1) * (s.lowSize[1] - s.lowSize[0]);
        builderAt(x, y).ball(size / 2, [x, level - size * 0.12, y], pick(RIVER_STONE_CELLS, SEED_RIVER_STONE + 2) ?? 'rock', {
          scale: [1, 0.62, 0.8 + hash2(qx, qy, SEED_RIVER_STONE + 3) * 0.3],
          rotation: [0, hash2(qx, qy, SEED_RIVER_STONE + 4) * 360, 0],
        });
      }
      if (hash2(qx, qy, SEED_RIVER_STONE + 5) < s.highChance) {
        // Remonter la pente jusqu'à `highAbove` au-dessus de l'eau.
        const [ux, uy] = this.uphill(x, y);
        let px = x;
        let py = y;
        for (let k = 0; k < 16 && this.bedHeight(px, py) < level + s.highAbove; k += 1) {
          px += ux * 0.05;
          py += uy * 0.05;
        }
        const along = (hash2(qx, qy, SEED_RIVER_STONE + 6) - 0.5) * s.spacing;
        px += -uy * along;
        py += ux * along;
        const size = s.highSize[0] + hash2(qx, qy, SEED_RIVER_STONE + 7) * (s.highSize[1] - s.highSize[0]);
        builderAt(px, py).ball(size / 2, [px, this.bedHeight(px, py) + size * 0.12, py], pick(RIVER_STONE_CELLS, SEED_RIVER_STONE + 8) ?? 'rock_light', {
          scale: [1, 0.55, 0.85],
          rotation: [0, hash2(qx, qy, SEED_RIVER_STONE + 9) * 360, 0],
        });
      }
    }
  }

  /** Touffes de roseaux posées sur la ligne d'eau la plus proche de leur place (réglages). */
  private reeds(builderAt: (x: number, y: number) => ShapeBuilder): void {
    const r = SETTINGS.river;
    const shore = this.shorePoints(r.stones.spacing / 2);
    r.reeds.forEach((clump, index) => {
      let best: { x: number; y: number } | null = null;
      let bestDistance = 2;
      for (const point of shore) {
        const d = Math.hypot(point.x - clump.x, point.y - clump.y);
        if (d < bestDistance) {
          best = point;
          bestDistance = d;
        }
      }
      if (best === null) {
        return;
      }
      for (let stem = 0; stem < clump.stems; stem += 1) {
        const seed = SEED_REED + index * 31 + stem;
        const angle = hash2(index, stem, seed) * Math.PI * 2;
        const reach = Math.sqrt(hash2(index, stem, seed + 1)) * 0.38;
        const x = best.x + Math.cos(angle) * reach;
        const y = best.y + Math.sin(angle) * reach * 0.7;
        const tall = r.reedHeight[0] + hash2(index, stem, seed + 2) * (r.reedHeight[1] - r.reedHeight[0]);
        // Les tiges penchent un peu, chacune à sa façon (pas de gerbe parfaite).
        const lean = (hash2(index, stem, seed + 3) - 0.5) * 16;
        const turn = hash2(index, stem, seed + 4) * 360;
        const cell = REED_CELLS[Math.floor(hash2(index, stem, seed + 5) * REED_CELLS.length)] ?? 'grass_dark';
        builderAt(x, y).cone(r.reedRadius, tall, [x, this.bedHeight(x, y) - 0.04, y], cell, {
          base: true,
          segments: 3,
          rotation: [lean, turn, lean / 2],
        });
      }
    });
  }

  /** Case de la carte ou de la bande prolongée (coordonnées rabattues sur le bord). */
  look(cx: number, cy: number): CellLook {
    const inside = cx >= 0 && cy >= 0 && cx < this.map.width && cy < this.map.height;
    const x = Math.min(this.map.width - 1, Math.max(0, cx));
    const y = Math.min(this.map.height - 1, Math.max(0, cy));
    const index = cellIndex(this.map, x, y);
    const raw = this.map.ground[index] ?? 'grass';
    const kind = inside ? raw : extendedKind(raw);
    const ford =
      (kind === 'water' && this.map.blocked[index] === false) ||
      (inside && kind === 'gravel' && this.fords.has(index));
    const height = ford
      ? SETTINGS.fordBed
      : kind === 'water'
        ? SETTINGS.heights.water
        : SETTINGS.heights[kind];
    return { kind, ford, height };
  }

  /**
   * Hauteur de la surface de l'eau dessinée sous un point, ou `null` hors de
   * l'eau (bouchon, ronds dans l'eau). Le gué est sous la même surface que la rivière.
   */
  waterLevelAt(x: number, y: number): number | null {
    const look = this.look(Math.floor(x), Math.floor(y));
    return look.kind === 'water' || look.ford || this.isStream(Math.floor(x), Math.floor(y))
      ? SETTINGS.waterSurface
      : null;
  }

  /** Hauteur du sol sous un point (pour poser personnages, objets et décor). */
  heightAt(x: number, y: number): number {
    for (const rect of this.floorRects) {
      if (inRect(rect, x, y)) {
        return rect.height;
      }
    }
    for (const crossing of this.crossings) {
      const h = crossingHeight(crossing, x, y);
      if (h !== null) {
        return h;
      }
    }
    if (this.isStream(Math.floor(x), Math.floor(y))) {
      // Le ru (hors des ouvrages, déjà vus): la surface de l'eau, le haut des berges au bord.
      return Math.max(SETTINGS.waterSurface, this.streamGround(x, y));
    }
    const look = this.look(Math.floor(x), Math.floor(y));
    if (look.kind === 'water' && !look.ford) {
      return SETTINGS.waterSurface;
    }
    if (look.kind === 'water' || look.kind === 'gravel') {
      // Berge et gué: le lit tel qu'il est dessiné (pentes douces, haut-fond de galets).
      return this.bedHeight(x, y);
    }
    let ground = look.height;
    for (const crossing of this.crossings) {
      ground = Math.max(ground, talusHeight(crossing, x, y));
    }
    return ground;
  }

  /** Vrai si l'herbe pousse là (touffes, fleurs, arbres du pourtour). */
  isGrass(cx: number, cy: number): boolean {
    return this.look(cx, cy).kind === 'grass' && !this.isStream(cx, cy);
  }

  /**
   * Hauteur du creux du ru au point: berges et fond (`ru.ts`), le haut au niveau du sol voisin;
   * à l'embouchure, le fond rejoint le lit de la rivière sur la dernière rangée.
   */
  private streamGround(x: number, y: number): number {
    const layout = this.stream;
    if (layout === null) {
      return 0;
    }
    const cy = Math.floor(y);
    const west = this.look(layout.x0 - 1, cy).height;
    const east = this.look(layout.x1, cy).height;
    const t = (x - layout.x0) / (layout.x1 - layout.x0);
    const top = west + (east - west) * Math.min(1, Math.max(0, t));
    const h = streamHeight(layout, x, y, top);
    const into = y - (layout.mouthY - 1);
    if (into <= 0) {
      return h;
    }
    const s = Math.min(1, into);
    const blend = s * s * (3 - 2 * s);
    return h + (this.bedHeight(x, layout.mouthY) - h) * blend;
  }

  private topCell(look: CellLook, cx: number, cy: number): PaletteCell {
    switch (look.kind) {
      case 'grass': {
        const n = valueNoise(cx, cy, SETTINGS.grassPatchScale, NOISE_SEED_GRASS);
        return n < DARK_GRASS_BELOW
          ? 'grass_dark'
          : n > LIGHT_GRASS_ABOVE
            ? 'grass_light'
            : 'grass';
      }
      case 'path':
        return valueNoise(cx, cy, SETTINGS.grassPatchScale / 2, NOISE_SEED_PATH) > PATH_DARK_ABOVE
          ? 'path_dark'
          : 'path';
      case 'dirt':
        return 'soil';
      case 'gravel':
        // Berge et gué: dessinés par le lit de la rivière, que le shader peint (plus de damier).
        return RIVER_BED_CELL;
      case 'wood':
        return cx % 2 === 0 ? 'wood' : 'wood_dark';
      case 'floor':
        return cy % 2 === 0 ? 'wood_new' : 'wood';
      case 'water':
        return look.ford ? 'cobble_dark' : 'water_deep';
      case 'rail':
        return hash2(cx, cy) < COBBLE_DARK_CHANCE ? 'ballast_dark' : 'ballast';
      case 'stone':
        // Une seule teinte: le shader des surfaces pose pavés et terre battue (bandes plus longues, moins de triangles).
        return 'cobble';
    }
  }

  private sideCell(kind: GroundKind): PaletteCell {
    switch (kind) {
      case 'grass':
      case 'dirt':
      case 'path':
      case 'water':
        return 'bank';
      case 'gravel':
        return 'rock_dark';
      case 'wood':
        return 'wood_dark';
      case 'floor':
        return 'stone_dark';
      case 'rail':
        return 'ballast_dark';
      case 'stone':
        return 'stone_dark';
    }
  }

  private insideBand(cx: number, cy: number): boolean {
    return (
      cx >= -this.ext &&
      cy >= -this.ext &&
      cx < this.map.width + this.ext &&
      cy < this.map.height + this.ext
    );
  }

  /**
   * Coin (sx, sy) de la case à arrondir: ses trois voisines de ce coin sont
   * d'un même autre sol arrondissable, à la même hauteur (bout ou angle
   * intérieur d'un chemin). Renvoie la teinte du coin rogné, ou `null`.
   */
  private cornerFill(
    cx: number,
    cy: number,
    look: CellLook,
    sx: number,
    sy: number,
  ): PaletteCell | null {
    if (!ROUNDED_KINDS.has(look.kind)) {
      return null;
    }
    const neighbours: [number, number][] = [
      [cx + sx, cy],
      [cx, cy + sy],
      [cx + sx, cy + sy],
    ];
    let kind: GroundKind | null = null;
    for (const [nx, ny] of neighbours) {
      if (!this.insideBand(nx, ny)) {
        return null;
      }
      const other = this.look(nx, ny);
      if (
        other.kind === look.kind ||
        Math.abs(other.height - look.height) > SETTINGS.cornerMaxStep ||
        !ROUNDED_KINDS.has(other.kind)
      ) {
        return null;
      }
      if (kind !== null && other.kind !== kind) {
        return null;
      }
      kind = other.kind;
    }
    return this.topCell(this.look(cx + sx, cy), cx + sx, cy);
  }

  /** Coins rognés d'une case (teinte par coin, `null` s'il reste droit); `null` si aucun. */
  private roundedCorners(cx: number, cy: number, look: CellLook): (PaletteCell | null)[] | null {
    const fills = CORNERS.map(([sx, sy]) => this.cornerFill(cx, cy, look, sx, sy));
    return fills.some((fill) => fill !== null) ? fills : null;
  }

  /**
   * Dessus d'une case aux coins arrondis (bible, 8.7: plus d'escalier de
   * cases): un éventail depuis le centre, et pour chaque coin rogné un petit
   * éventail à la teinte du sol voisin. La grille de la simulation ne change pas.
   */
  private roundedTop(
    writer: GeometryWriter,
    cx: number,
    cy: number,
    height: number,
    cell: PaletteCell,
    fills: readonly (PaletteCell | null)[],
  ): void {
    const up = [0, 1, 0] as const;
    const radius = SETTINGS.cornerRadius;
    const segments = SETTINGS.cornerSegments;
    const centre: [number, number, number] = [cx + 0.5, height, cy + 0.5];
    const outline: [number, number, number][] = [];
    CORNERS.forEach(([sx, sy], index) => {
      const corner: [number, number, number] = [
        cx + (sx > 0 ? 1 : 0),
        height,
        cy + (sy > 0 ? 1 : 0),
      ];
      const fill = fills[index] ?? null;
      if (fill === null) {
        outline.push(corner);
        return;
      }
      // Quart de cercle de centre `pivot`, du bord vertical au bord horizontal de la case.
      const pivotX = corner[0] - sx * radius;
      const pivotZ = corner[2] - sy * radius;
      const arc: [number, number, number][] = [];
      for (let i = 0; i <= segments; i += 1) {
        const angle = (i / segments) * (Math.PI / 2);
        arc.push([
          pivotX + sx * radius * Math.cos(angle),
          height,
          pivotZ + sy * radius * Math.sin(angle),
        ]);
      }
      for (let i = 0; i < segments; i += 1) {
        const a = arc[i];
        const b = arc[i + 1];
        if (a !== undefined && b !== undefined) {
          writer.triangle(corner, a, b, up, fill);
        }
      }
      // Dans l'ordre du pourtour: les coins impairs parcourent l'arc à l'envers.
      outline.push(...(sx * sy > 0 ? arc : arc.reverse()));
    });
    for (let i = 0; i < outline.length; i += 1) {
      const a = outline[i];
      const b = outline[(i + 1) % outline.length];
      if (a !== undefined && b !== undefined) {
        writer.triangle(centre, a, b, up, cell);
      }
    }
  }

  /** Normale du lit au point (pente douce): différences centrées sur la grille fine. */
  private bedNormal(x: number, y: number): [number, number, number] {
    const e = this.river.step;
    const nx = -(this.bedHeight(x + e, y) - this.bedHeight(x - e, y)) / (2 * e);
    const nz = -(this.bedHeight(x, y + e) - this.bedHeight(x, y - e)) / (2 * e);
    const length = Math.hypot(nx, 1, nz);
    return [nx / length, 1 / length, nz / length];
  }

  /**
   * Lit de la rivière (berges, gué, fond): une case plate reste un seul
   * quadrilatère; une case en pente est quadrillée (`river.subdivisions`), aux
   * normales douces. Au bord de la bande prolongée, une joue ferme le lit
   * jusqu'au pourtour.
   */
  private buildRiverBed(writerAt: (cx: number, cy: number) => GeometryWriter): void {
    const n = SETTINGS.river.subdivisions;
    const size = 1 / n;
    const ring = -SETTINGS.outerDrop;
    for (let cy = -this.ext; cy < this.map.height + this.ext; cy += 1) {
      for (let cx = -this.ext; cx < this.map.width + this.ext; cx += 1) {
        if (!this.inRiverBed(cx, cy)) {
          continue;
        }
        const writer = writerAt(cx, cy);
        const heights: number[] = [];
        for (let j = 0; j <= n; j += 1) {
          for (let i = 0; i <= n; i += 1) {
            heights.push(this.bedHeight(cx + i * size, cy + j * size));
          }
        }
        const first = heights[0] ?? 0;
        const point = (i: number, j: number): [number, number, number] => [
          cx + i * size,
          heights[j * (n + 1) + i] ?? first,
          cy + j * size,
        ];
        if (heights.every((h) => Math.abs(h - first) < FLAT_EPSILON)) {
          writer.quad([point(0, 0), point(0, n), point(n, n), point(n, 0)], [0, 1, 0], RIVER_BED_CELL);
        } else {
          const normals: [number, number, number][] = [];
          for (let j = 0; j <= n; j += 1) {
            for (let i = 0; i <= n; i += 1) {
              normals.push(this.bedNormal(cx + i * size, cy + j * size));
            }
          }
          const normal = (i: number, j: number): [number, number, number] =>
            normals[j * (n + 1) + i] ?? [0, 1, 0];
          for (let j = 0; j < n; j += 1) {
            for (let i = 0; i < n; i += 1) {
              writer.smoothTriangle(
                [point(i, j), point(i + 1, j + 1), point(i + 1, j)],
                [normal(i, j), normal(i + 1, j + 1), normal(i + 1, j)],
                RIVER_BED_CELL,
              );
              writer.smoothTriangle(
                [point(i, j), point(i, j + 1), point(i + 1, j + 1)],
                [normal(i, j), normal(i, j + 1), normal(i + 1, j + 1)],
                RIVER_BED_CELL,
              );
            }
          }
        }
        // Joues au bord de la bande: le lit ne s'ouvre jamais sur le vide.
        for (const side of SIDES) {
          if (this.insideBand(cx + side.dx, cy + side.dy)) {
            continue;
          }
          for (let s = 0; s < n; s += 1) {
            const [a, b]: [[number, number], [number, number]] =
              side.dx === 1
                ? [[n, s], [n, s + 1]]
                : side.dx === -1
                  ? [[0, s], [0, s + 1]]
                  : side.dy === 1
                    ? [[s, n], [s + 1, n]]
                    : [[s, 0], [s + 1, 0]];
            const pa = point(a[0], a[1]);
            const pb = point(b[0], b[1]);
            const facesOut = (pa[1] + pb[1]) / 2 > ring;
            writer.quad(
              [pa, pb, [pb[0], ring, pb[2]], [pa[0], ring, pa[2]]],
              facesOut ? [side.dx, 0, side.dy] : [-side.dx, 0, -side.dy],
              'bank',
            );
          }
        }
      }
    }
  }

  /**
   * Sol en morceaux de `surfaceChunk` m (élimination hors du cadre, dans la vue et dans la passe
   * d'ombre): une géométrie par morceau.
   */
  private buildGround(writerAt: (x: number, y: number) => GeometryWriter): void {
    const size = SETTINGS.surfaceChunk;
    const chunkColumn = (cx: number): number => Math.floor((cx + this.ext) / size);
    const up = [0, 1, 0] as const;
    const ringHeight = -SETTINGS.outerDrop;
    for (let cy = -this.ext; cy < this.map.height + this.ext; cy += 1) {
      // Dessus: les cases voisines de même aspect sont fusionnées en bandes (moins de triangles),
      // sans déborder de leur morceau.
      let runStart = -this.ext;
      let runCell: PaletteCell | null = null;
      let runHeight = 0;
      for (let cx = -this.ext; cx <= this.map.width + this.ext; cx += 1) {
        const atEnd = cx === this.map.width + this.ext;
        const raw = atEnd ? null : this.look(cx, cy);
        // Les traversées en planches (`buildCrossing`), le lit de la rivière et le ru sont dessinés à part.
        const look =
          raw !== null &&
          ((raw.kind === 'wood' && !this.isStream(cx, cy)) ||
            this.inRiverBed(cx, cy) ||
            this.isStream(cx, cy))
            ? null
            : raw;
        const cell = look === null ? null : this.topCell(look, cx, cy);
        const fills = look === null ? null : this.roundedCorners(cx, cy, look);
        const writer = writerAt(runCell !== null ? runStart : cx, cy);
        if (
          runCell !== null &&
          (look === null ||
            fills !== null ||
            cell !== runCell ||
            look.height !== runHeight ||
            chunkColumn(cx) !== chunkColumn(runStart))
        ) {
          writer.quad(
            [
              [runStart, runHeight, cy],
              [runStart, runHeight, cy + 1],
              [cx, runHeight, cy + 1],
              [cx, runHeight, cy],
            ],
            up,
            runCell,
          );
          runCell = null;
        }
        if (look !== null && cell !== null && fills !== null) {
          this.roundedTop(writerAt(cx, cy), cx, cy, look.height, cell, fills);
          continue;
        }
        if (look === null) {
          continue;
        }
        if (cell !== null && runCell === null) {
          runStart = cx;
          runCell = cell;
          runHeight = look.height;
        }
      }
      // Côtés: une marche là où le voisin est plus bas; au bord de la bande, on ferme vers le pourtour.
      for (let cx = -this.ext; cx < this.map.width + this.ext; cx += 1) {
        const look = this.look(cx, cy);
        if (look.kind === 'wood' || this.inRiverBed(cx, cy) || this.isStream(cx, cy)) {
          continue;
        }
        const writer = writerAt(cx, cy);
        const h = look.height;
        for (const side of SIDES) {
          const outside = !this.insideBand(cx + side.dx, cy + side.dy);
          const neighbourHeight = outside
            ? ringHeight
            : this.look(cx + side.dx, cy + side.dy).height;
          if (
            neighbourHeight === h ||
            (!outside && neighbourHeight > h) ||
            (!outside && this.look(cx + side.dx, cy + side.dy).kind === 'wood') ||
            // Le lit de la rivière rejoint ses voisins à leur hauteur: pas de marche.
            (!outside && this.inRiverBed(cx + side.dx, cy + side.dy)) ||
            // Le creux du ru dessine lui-même ses berges et ses têtes contre le remblai.
            (!outside && this.isStream(cx + side.dx, cy + side.dy))
          ) {
            continue;
          }
          const low = Math.min(h, neighbourHeight);
          const high = Math.max(h, neighbourHeight);
          const facesOut = neighbourHeight < h;
          const x0 = side.dx === 1 ? cx + 1 : cx;
          const z0 = side.dy === 1 ? cy + 1 : cy;
          const alongX = side.dx === 0;
          const x1 = alongX ? x0 + 1 : x0;
          const z1 = alongX ? z0 : z0 + 1;
          writer.quad(
            [
              [x0, low, z0],
              [x1, low, z1],
              [x1, high, z1],
              [x0, high, z0],
            ],
            facesOut ? [side.dx, 0, side.dy] : [-side.dx, 0, -side.dy],
            this.sideCell(look.kind),
          );
        }
      }
    }
    for (const crossing of this.crossings) {
      const middle = (crossing.u0 + crossing.u1) / 2;
      buildCrossing(
        crossing.alongX ? writerAt(middle, crossing.axis) : writerAt(crossing.axis, middle),
        crossing,
      );
    }
  }

  /**
   * Traversées: rectangles des cases `wood` d'un seul tenant, dans le sens
   * de la voie qui les borde (cases de voie à leurs deux bouts).
   */
  private findCrossings(): void {
    const map = this.map;
    const seen = new Set<number>();
    const isWood = (cx: number, cy: number): boolean =>
      cx >= 0 &&
      cy >= 0 &&
      cx < map.width &&
      cy < map.height &&
      map.ground[cellIndex(map, cx, cy)] === 'wood' &&
      // La passerelle du ru est un modèle (`footbridge`), pas une traversée de voie.
      !this.isStream(cx, cy);
    for (let cy = 0; cy < map.height; cy += 1) {
      for (let cx = 0; cx < map.width; cx += 1) {
        if (!isWood(cx, cy) || seen.has(cellIndex(map, cx, cy))) {
          continue;
        }
        let x1 = cx;
        while (isWood(x1 + 1, cy)) {
          x1 += 1;
        }
        let y1 = cy;
        while (isWood(cx, y1 + 1)) {
          y1 += 1;
        }
        for (let y = cy; y <= y1; y += 1) {
          for (let x = cx; x <= x1; x += 1) {
            seen.add(cellIndex(map, x, y));
          }
        }
        const railAt = (x: number, y: number): boolean => this.look(x, y).kind === 'rail';
        const alongX = railAt(cx - 1, cy) || railAt(x1 + 1, cy);
        const [u0, u1, v0, v1] = alongX ? [cx, x1 + 1, cy, y1 + 1] : [cy, y1 + 1, cx, x1 + 1];
        const axis = (v0 + v1) / 2;
        const half = (v1 - v0) / 2;
        const deckHalf = Math.min(
          half,
          CROSSING.railOffset +
            CROSSING.railHeadWidth / 2 +
            CROSSING.outerClearance +
            CROSSING.outerBand,
        );
        const top = SETTINGS.heights.wood;
        // Route au pied de la rampe: la case au milieu de la traversée, juste au-delà de chaque bord.
        const mid = Math.floor((u0 + u1) / 2);
        const beyond = (v: number): number => {
          const look = alongX ? this.look(mid, v) : this.look(v, mid);
          const floor = this.floorRects.find((rect) =>
            alongX ? inRect(rect, mid + 0.5, v + 0.5) : inRect(rect, v + 0.5, mid + 0.5),
          );
          return floor?.height ?? look.height;
        };
        const feet = [beyond(v0 - 1), beyond(v1)].map((h) => (h < top ? h : null));
        const deck: [number, number] = [
          feet[0] === null ? half : deckHalf,
          feet[1] === null ? half : deckHalf,
        ];
        this.crossings.push({
          alongX,
          axis,
          u0,
          u1,
          deck,
          rampFoot: [feet[0] ?? null, feet[1] ?? null],
        });
      }
    }
  }

  /** Surface de la rivière et du gué, en morceaux de `surfaceChunk` m (le ru a la sienne). */
  private buildWater(): Map<string, BufferGeometry> {
    const writers = new Map<string, GeometryWriter>();
    const up = [0, 1, 0] as const;
    const steps = SETTINGS.waterSubdivisions;
    const size = 1 / steps;
    for (let cy = -this.ext; cy < this.map.height + this.ext; cy += 1) {
      for (let cx = -this.ext; cx < this.map.width + this.ext; cx += 1) {
        const look = this.look(cx, cy);
        // Une seule surface pour la rivière et le gué (le lit monte au-dessus d'elle sur les berges).
        if ((look.kind !== 'water' && !look.ford) || this.isStream(cx, cy)) {
          continue;
        }
        const key = this.chunkOf(cx, cy);
        let writer = writers.get(key);
        if (writer === undefined) {
          writer = new GeometryWriter();
          writers.set(key, writer);
        }
        const h = SETTINGS.waterSurface;
        for (let sy = 0; sy < steps; sy += 1) {
          for (let sx = 0; sx < steps; sx += 1) {
            const x = cx + sx * size;
            const z = cy + sy * size;
            writer.quad(
              [
                [x, h, z],
                [x, h, z + size],
                [x + size, h, z + size],
                [x + size, h, z],
              ],
              up,
              'water',
            );
          }
        }
      }
    }
    const out = new Map<string, BufferGeometry>();
    for (const [key, writer] of writers) {
      out.set(key, writer.build());
    }
    return out;
  }

  /**
   * Le ru de la Côte (`ru.ts`): creux à berges raides et fond de galets, tête de maçonnerie
   * contre le remblai de la voie, surface de l'eau; en morceaux de `surfaceChunk` m le long du ru.
   */
  private buildStreamBed(
    writerAt: (x: number, y: number) => GeometryWriter,
    addPiece: (x: number, y: number, geometry: BufferGeometry) => void,
  ): void {
    this.streamGeometry(writerAt, addPiece, null);
  }

  private buildStreamWater(materials: SharedMaterials, resources: ResourceTracker): void {
    const waters = new Map<string, GeometryWriter>();
    this.streamGeometry(null, null, (x, y) => {
      const key = this.chunkOf(x, y);
      let writer = waters.get(key);
      if (writer === undefined) {
        writer = new GeometryWriter();
        waters.set(key, writer);
      }
      return writer;
    });
    for (const [key, writer] of waters) {
      const mesh = new Mesh(resources.track(writer.build()), materials.water);
      mesh.name = `eau du ru ${key}`;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.renderOrder = 1;
      this.streamWater.push(mesh);
      this.group.add(mesh);
    }
  }

  /** Géométrie du ru: creux et galets (`bedAt`, `addPiece`) ou surface de l'eau (`waterAt`). */
  private streamGeometry(
    bedWriterAt: ((x: number, y: number) => GeometryWriter) | null,
    addPiece: ((x: number, y: number, geometry: BufferGeometry) => void) | null,
    waterWriterAt: ((x: number, y: number) => GeometryWriter) | null,
  ): void {
    const layout = this.stream;
    if (layout === null) {
      return;
    }
    const s = SETTINGS.stream;
    const across = s.across;
    const width = layout.x1 - layout.x0;
    const fallback = new GeometryWriter();
    const bedAt = (y: number): GeometryWriter => bedWriterAt?.(layout.x0 + width / 2, y) ?? fallback;
    const waterAt = (y: number): GeometryWriter => waterWriterAt?.(layout.x0 + width / 2, y) ?? fallback;
    const point = (i: number, y: number): [number, number, number] => {
      const x = layout.x0 + (i / (across - 1)) * width;
      return [x, this.streamGround(x, y), y];
    };
    const normalAt = (x: number, y: number): [number, number, number] => {
      const e = 0.06;
      const nx = -(this.streamGround(x + e, y) - this.streamGround(x - e, y)) / (2 * e);
      const nz = -(this.streamGround(x, y + e) - this.streamGround(x, y - e)) / (2 * e);
      const length = Math.hypot(nx, 1, nz);
      return [nx / length, 1 / length, nz / length];
    };
    const tone = (h: number): PaletteCell =>
      h < s.bed + s.toeRise + 0.02 ? 'rock_dark' : h < SETTINGS.waterSurface + 0.05 ? 'rock' : 'bank';
    const surface = SETTINGS.waterSurface;
    for (let cy = layout.fromY; cy < layout.mouthY; cy += 1) {
      if (layout.embankment.has(cy)) {
        continue;
      }
      for (let y = cy; y < cy + 1 - 1e-6; y += s.step) {
        const y1 = Math.min(cy + 1, y + s.step);
        const writer = bedAt(y);
        for (let i = 0; i < across - 1 && bedWriterAt !== null; i += 1) {
          const a = point(i, y);
          const b = point(i + 1, y);
          const c = point(i + 1, y1);
          const d = point(i, y1);
          const cell = tone((a[1] + b[1] + c[1] + d[1]) / 4);
          writer.smoothTriangle([a, c, b], [normalAt(a[0], a[2]), normalAt(c[0], c[2]), normalAt(b[0], b[2])], cell);
          writer.smoothTriangle([a, d, c], [normalAt(a[0], a[2]), normalAt(d[0], d[2]), normalAt(c[0], c[2])], cell);
        }
        // Surface de l'eau, d'une berge à l'autre (les berges, au-dessus, en cachent le bord).
        const water = waterAt(y);
        const half = width / 2;
        const mid = layout.x0 + half;
        for (const [u0, u1] of waterWriterAt === null ? [] : [
          [-0.47, 0],
          [0, 0.47],
        ] as const) {
          water.quad(
            [
              [mid + u0 * width, surface, y],
              [mid + u0 * width, surface, y1],
              [mid + u1 * width, surface, y1],
              [mid + u1 * width, surface, y],
            ],
            [0, 1, 0],
            'water',
          );
        }
        // Galets du fond: quelques-uns affleurent, le courant s'ouvre autour.
        const seed = Math.round(y * 16);
        if (addPiece !== null && hash2(seed, 7, SEED_STREAM_STONE) < s.step / s.pebbleSpacing) {
          const u = (hash2(seed, 8, SEED_STREAM_STONE) - 0.5) * 0.7;
          const x = mid + u * half;
          const size = s.pebbleSize[0] + hash2(seed, 9, SEED_STREAM_STONE) * (s.pebbleSize[1] - s.pebbleSize[0]);
          const py = y + hash2(seed, 10, SEED_STREAM_STONE) * s.step;
          const stone = new ShapeBuilder().ball(size / 2, [x, this.streamGround(x, py) + size * 0.1, py], RIVER_STONE_CELLS[seed % RIVER_STONE_CELLS.length] ?? 'rock', {
            scale: [1, 0.6, 0.85],
            rotation: [0, hash2(seed, 11, SEED_STREAM_STONE) * 360, 0],
          });
          addPiece(x, py, stone.build());
        }
      }
      // Têtes contre le remblai de la voie (ponceau) et au bout de la bande prolongée.
      for (const [edgeY, toward, top] of [
        [cy, -1, layout.embankment.has(cy - 1) ? this.look(layout.x0, cy - 1).height : null],
        [cy + 1, 1, layout.embankment.has(cy + 1) ? this.look(layout.x0, cy + 1).height : null],
        [cy, -1, cy === layout.fromY ? -SETTINGS.outerDrop : null],
      ] as const) {
        if (top === null || bedWriterAt === null) {
          continue;
        }
        const writer = bedAt(cy + 0.5);
        for (let i = 0; i < across - 1; i += 1) {
          const a = point(i, edgeY);
          const b = point(i + 1, edgeY);
          writer.quad(
            [a, b, [b[0], Math.max(top, b[1]), edgeY], [a[0], Math.max(top, a[1]), edgeY]],
            [0, 0, -toward],
            'stone_dark',
          );
        }
      }
    }
  }

  /** Cadre d'herbe au-delà de la bande prolongée, jusqu'à l'horizon. */
  private buildOuterRing(): BufferGeometry {
    const writer = new GeometryWriter();
    const up = [0, 1, 0] as const;
    const half = SETTINGS.outerSize / 2;
    const cx = this.map.width / 2;
    const cy = this.map.height / 2;
    const x0 = -this.ext;
    const x1 = this.map.width + this.ext;
    const y0 = -this.ext;
    const y1 = this.map.height + this.ext;
    const h = -SETTINGS.outerDrop;
    const rects: [number, number, number, number][] = [
      [cx - half, cy - half, cx + half, y0],
      [cx - half, y1, cx + half, cy + half],
      [cx - half, y0, x0, y1],
      [x1, y0, cx + half, y1],
    ];
    for (const [ax, ay, bx, by] of rects) {
      writer.quad(
        [
          [ax, h, ay],
          [ax, h, by],
          [bx, h, by],
          [bx, h, ay],
        ],
        up,
        'grass_dark',
      );
    }
    return writer.build();
  }
}

type Point3 = [number, number, number];

/** Point du repère d'une traversée (u le long des rails, v en travers) vers le monde (x, hauteur, z). */
function crossingPoint(c: Crossing, u: number, v: number, h: number): Point3 {
  return c.alongX ? [u, h, c.axis + v] : [c.axis + v, h, u];
}

function crossingNormal(c: Crossing, nu: number, nv: number, ny: number): [number, number, number] {
  const length = Math.hypot(nu, nv, ny);
  return c.alongX
    ? [nu / length, ny / length, nv / length]
    : [nv / length, ny / length, nu / length];
}

/** Dessus du platelage côté route, au bord d'une lame chanfreinée: là où la rampe s'y raccorde. */
function rampTop(): number {
  return SETTINGS.heights.wood - CROSSING.chamfer;
}

/** Hauteur du sol sur une traversée ou sa rampe, ou `null` hors d'elles. */
function crossingHeight(c: Crossing, x: number, y: number): number | null {
  const u = c.alongX ? x : y;
  const v = (c.alongX ? y : x) - c.axis;
  if (u < c.u0 || u >= c.u1) {
    return null;
  }
  const side = v < 0 ? 0 : 1;
  const edge = c.deck[side];
  const distance = Math.abs(v);
  if (distance <= edge) {
    return SETTINGS.heights.wood;
  }
  const foot = c.rampFoot[side];
  if (foot === null || distance > edge + CROSSING.rampLength) {
    return null;
  }
  const t = (distance - edge) / CROSSING.rampLength;
  return rampTop() + (foot - rampTop()) * t;
}

/**
 * Hauteur des talus d'une traversée sous un point hors de la route (même
 * géométrie que `buildCrossing`), ou `-Infinity` hors d'eux.
 */
function talusHeight(c: Crossing, x: number, y: number): number {
  const u = c.alongX ? x : y;
  const v = (c.alongX ? y : x) - c.axis;
  const out = u < c.u0 ? c.u0 - u : u > c.u1 ? u - c.u1 : 0;
  if (out <= 0) {
    return Number.NEGATIVE_INFINITY;
  }
  const side = v < 0 ? 0 : 1;
  const foot = c.rampFoot[side];
  if (foot === null) {
    return Number.NEGATIVE_INFINITY;
  }
  const edge = c.deck[side];
  const distance = Math.abs(v);
  const run = CROSSING.talusRun;
  if (distance <= edge) {
    // Coin contre le bout du platelage.
    return rampTop() - (out + edge - distance) / run;
  }
  if (distance > edge + CROSSING.rampLength) {
    return Number.NEGATIVE_INFINITY;
  }
  const t = (distance - edge) / CROSSING.rampLength;
  return rampTop() + (foot - rampTop()) * t - out / run;
}

/**
 * Une lame posée dans le sens des rails, de `u0` à `u1`, de `va` à `vb` en
 * travers: dessus chanfreiné sur ses quatre arêtes, bouts jusqu'au fond.
 */
function plank(
  writer: GeometryWriter,
  c: Crossing,
  va: number,
  vb: number,
  tone: PaletteCell,
): void {
  const top = SETTINGS.heights.wood;
  const ch = CROSSING.chamfer;
  const low = top - ch;
  const base = top - CROSSING.plankThickness;
  const { u0, u1 } = c;
  const p = (u: number, v: number, h: number): Point3 => crossingPoint(c, u, v, h);
  writer.quad(
    [
      p(u0 + ch, va + ch, top),
      p(u1 - ch, va + ch, top),
      p(u1 - ch, vb - ch, top),
      p(u0 + ch, vb - ch, top),
    ],
    [0, 1, 0],
    tone,
  );
  // Chanfreins: le long des rails (côtés v), puis aux bouts (côtés u).
  writer.quad(
    [p(u0 + ch, va + ch, top), p(u1 - ch, va + ch, top), p(u1, va, low), p(u0, va, low)],
    crossingNormal(c, 0, -1, 1),
    tone,
  );
  writer.quad(
    [p(u0 + ch, vb - ch, top), p(u1 - ch, vb - ch, top), p(u1, vb, low), p(u0, vb, low)],
    crossingNormal(c, 0, 1, 1),
    tone,
  );
  writer.quad(
    [p(u0 + ch, va + ch, top), p(u0 + ch, vb - ch, top), p(u0, vb, low), p(u0, va, low)],
    crossingNormal(c, -1, 0, 1),
    tone,
  );
  writer.quad(
    [p(u1 - ch, va + ch, top), p(u1 - ch, vb - ch, top), p(u1, vb, low), p(u1, va, low)],
    crossingNormal(c, 1, 0, 1),
    tone,
  );
  // Bouts et flancs, du chanfrein au fond (les flancs ne se voient qu'aux fentes, on les garde simples).
  writer.quad(
    [p(u0, va, low), p(u0, vb, low), p(u0, vb, base), p(u0, va, base)],
    crossingNormal(c, -1, 0, 0),
    tone,
  );
  writer.quad(
    [p(u1, va, low), p(u1, vb, low), p(u1, vb, base), p(u1, va, base)],
    crossingNormal(c, 1, 0, 0),
    tone,
  );
  writer.quad(
    [p(u0, va, low), p(u1, va, low), p(u1, va, base), p(u0, va, base)],
    crossingNormal(c, 0, -1, 0),
    tone,
  );
  writer.quad(
    [p(u0, vb, low), p(u1, vb, low), p(u1, vb, base), p(u0, vb, base)],
    crossingNormal(c, 0, 1, 0),
    tone,
  );
}

/**
 * Lames qui remplissent une bande de `va` à `vb`, au plus près de la largeur
 * visée. `railAt`: bouts de la bande qui longent un rail (début, fin), où la
 * lame prend `railSideTone`.
 */
function plankBand(
  writer: GeometryWriter,
  c: Crossing,
  va: number,
  vb: number,
  next: () => PaletteCell,
  railAt: readonly [boolean, boolean],
): void {
  const width = vb - va;
  if (width <= CROSSING.chamfer * 2) {
    return;
  }
  const count = Math.max(1, Math.round(width / CROSSING.plankWidth));
  const step = width / count;
  for (let i = 0; i < count; i += 1) {
    const tone = next();
    const alongRail = (i === 0 && railAt[0]) || (i === count - 1 && railAt[1]);
    plank(writer, c, va + i * step, va + (i + 1) * step, alongRail ? CROSSING.railSideTone : tone);
  }
}

/**
 * Platelage d'une traversée (revue du directeur artistique, tour 5): fond
 * sombre des ornières, lames dans le sens des rails (dessus 1,5 cm sous le
 * champignon), bouts fermés jusqu'au ballast, rampes de terre côté route.
 */
function buildCrossing(writer: GeometryWriter, c: Crossing): void {
  const top = SETTINGS.heights.wood;
  const base = top - CROSSING.plankThickness;
  const railGround = SETTINGS.heights.rail;
  const [north, south] = c.deck;
  const { u0, u1 } = c;
  const p = (u: number, v: number, h: number): Point3 => crossingPoint(c, u, v, h);
  // Fond des ornières (au-dessus des traverses, à 0,28 m: elles ne percent pas).
  writer.quad(
    [p(u0, -north, base), p(u1, -north, base), p(u1, south, base), p(u0, south, base)],
    [0, 1, 0],
    CROSSING.grooveTone,
  );
  // Bouts côté voie: une joue de la hauteur du ballast au fond des lames.
  writer.quad(
    [p(u0, -north, railGround), p(u0, south, railGround), p(u0, south, base), p(u0, -north, base)],
    crossingNormal(c, -1, 0, 0),
    CROSSING.endTone,
  );
  writer.quad(
    [p(u1, -north, railGround), p(u1, south, railGround), p(u1, south, base), p(u1, -north, base)],
    crossingNormal(c, 1, 0, 0),
    CROSSING.endTone,
  );
  // Lames: bande extérieure, entre les rails (ornières de chaque côté), bande extérieure.
  const tones = CROSSING.plankTones;
  // Départ du motif selon la place de la traversée: deux traversées ne se ressemblent pas.
  let index = Math.abs(Math.floor(c.u0));
  const next = (): PaletteCell => {
    const tone = tones[index % tones.length] ?? 'wood';
    index += 1;
    return tone;
  };
  const rail = CROSSING.railOffset;
  const head = CROSSING.railHeadWidth / 2;
  const outer = rail + head + CROSSING.outerClearance;
  const inner = rail - head - CROSSING.flangeway;
  plankBand(writer, c, -north, -outer, next, [false, true]);
  plankBand(writer, c, -inner, inner, next, [true, true]);
  plankBand(writer, c, outer, south, next, [true, false]);
  // Rampes de terre: la route monte doucement jusqu'au bord des lames.
  const sides: [number, number][] = [
    [-1, north],
    [1, south],
  ];
  sides.forEach(([sign, edge], side) => {
    const foot = c.rampFoot[side];
    if (foot === null || foot === undefined) {
      // Côté sans rampe (contre le quai): flanc fermé jusque sous le sol. Sans lui, là où le
      // modèle du quai s'abaisse (rampe du bout est), on voyait le ciel sous le platelage.
      writer.quad(
        [
          p(u0, sign * edge, base),
          p(u1, sign * edge, base),
          p(u1, sign * edge, Math.min(railGround, 0)),
          p(u0, sign * edge, Math.min(railGround, 0)),
        ],
        crossingNormal(c, 0, sign, 0),
        CROSSING.endTone,
      );
      return;
    }
    const far = edge + CROSSING.rampLength;
    const high = rampTop();
    const normal = crossingNormal(c, 0, sign * (high - foot), CROSSING.rampLength);
    writer.quad(
      [
        p(u0, sign * edge, high),
        p(u1, sign * edge, high),
        p(u1, sign * far, foot),
        p(u0, sign * far, foot),
      ],
      normal,
      CROSSING.rampTone,
    );
    // Talus de terre aux deux bords de la route (revue du directeur artistique,
    // tour 5): la rampe retombe en pente douce vers le ballast et les bas-côtés,
    // jusque sous le sol, au lieu d'une joue verticale qui pointait comme une lame.
    const bottom = Math.min(foot, 0);
    const run = CROSSING.talusRun;
    const nearDrop = (high - bottom) * run;
    const farDrop = (foot - bottom) * run;
    for (const [u, nu] of [
      [u0, -1],
      [u1, 1],
    ] as const) {
      const crest = p(u, sign * edge, high);
      const low = p(u, sign * far, foot);
      const nearFoot = p(u + nu * nearDrop, sign * edge, bottom);
      if (farDrop > TALUS_EPSILON) {
        const farFoot = p(u + nu * farDrop, sign * far, bottom);
        writer.quad(
          [crest, low, farFoot, nearFoot],
          upwardNormal(crest, low, nearFoot),
          CROSSING.rampSideTone,
        );
      } else {
        // Pied de rampe au niveau du bas: triangle (un quadrilatère dégénéré serait mal orienté).
        writer.triangle(
          crest,
          low,
          nearFoot,
          upwardNormal(crest, low, nearFoot),
          CROSSING.rampSideTone,
        );
      }
      // Coin contre le bout du platelage: la même pente tourne vers la voie.
      const cornerFoot = p(u, sign * (edge - nearDrop), bottom);
      writer.triangle(
        crest,
        nearFoot,
        cornerFoot,
        upwardNormal(crest, nearFoot, cornerFoot),
        CROSSING.rampSideTone,
      );
    }
  });
}

/** Écart (m) sous lequel le pied du talus est confondu avec le bas de la rampe. */
const TALUS_EPSILON = 1e-4;

/** Normale unitaire du plan a, b, c, tournée vers le ciel. */
function upwardNormal(a: Point3, b: Point3, c: Point3): [number, number, number] {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  if (ny < 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }
  const length = Math.hypot(nx, ny, nz) || 1;
  return [nx / length, ny / length, nz / length];
}
