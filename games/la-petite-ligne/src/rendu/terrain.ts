/**
 * Terrain d'après la grille de la carte: un seul maillage pour tous les sols
 * (texture palette, un appel de dessin), avec des marches propres là où deux
 * sols n'ont pas la même hauteur (berges, gué, traversées), l'eau animée de la
 * rivière, et une bande prolongée au-delà du bord pour ne jamais voir le vide
 * (la rivière, la voie et les chemins continuent; la forêt du pourtour pousse
 * dans `vegetation.ts`).
 */
import { BufferAttribute, BufferGeometry, Group, Mesh, Vector3 } from 'three';
import type { GameMap, GroundKind, MapProp } from '../etat/carte';
import { cellIndex, inRect } from '../etat/carte';
import { valueNoise, hash2 } from './bruit';
import type { SharedMaterials } from './materiaux';
import { paletteUv, type PaletteCell } from './palette';
import { RENDER_SETTINGS } from './reglages';
import type { ResourceTracker } from './ressources';

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
 * place, gravier (écart de hauteur d'au plus `cornerMaxStep`).
 */
const ROUNDED_KINDS: ReadonlySet<GroundKind> = new Set<GroundKind>([
  'grass',
  'path',
  'stone',
  'gravel',
]);
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
  /** Surface de la rivière (point d'accroche du technical artist: matériau d'eau). */
  readonly water: Mesh;
  private readonly ext = SETTINGS.extension;
  private readonly floorRects: { x: number; y: number; w: number; h: number; height: number }[] =
    [];

  /**
   * `floorHeight`: hauteur de marche d'un sol posé (quai, ponton), lue dans les
   * données de l'artiste quand elles existent.
   */
  constructor(
    private readonly map: GameMap,
    materials: SharedMaterials,
    resources: ResourceTracker,
    floorHeight: (prop: MapProp) => number | undefined = (prop) =>
      RENDER_SETTINGS.floorProps[prop.model],
  ) {
    this.group.name = 'terrain';
    for (const prop of map.props) {
      const height = floorHeight(prop);
      if (height !== undefined && prop.rect !== null) {
        this.floorRects.push({ ...prop.rect, height });
      }
    }
    const ground = new Mesh(resources.track(this.buildGround()), materials.palette);
    ground.name = 'sol';
    ground.receiveShadow = true;
    ground.matrixAutoUpdate = false;
    const water = new Mesh(resources.track(this.buildWater()), materials.water);
    this.water = water;
    water.name = 'eau';
    water.receiveShadow = true;
    water.matrixAutoUpdate = false;
    water.renderOrder = 1;
    const outer = new Mesh(resources.track(this.buildOuterRing()), materials.palette);
    outer.name = 'pourtour';
    outer.receiveShadow = true;
    outer.matrixAutoUpdate = false;
    this.group.add(ground, water, outer);
  }

  /** Case de la carte ou de la bande prolongée (coordonnées rabattues sur le bord). */
  look(cx: number, cy: number): CellLook {
    const inside = cx >= 0 && cy >= 0 && cx < this.map.width && cy < this.map.height;
    const x = Math.min(this.map.width - 1, Math.max(0, cx));
    const y = Math.min(this.map.height - 1, Math.max(0, cy));
    const index = cellIndex(this.map, x, y);
    const raw = this.map.ground[index] ?? 'grass';
    const kind = inside ? raw : extendedKind(raw);
    const ford = kind === 'water' && this.map.blocked[index] === false;
    const height =
      kind === 'water'
        ? ford
          ? SETTINGS.fordBed
          : SETTINGS.heights.water
        : SETTINGS.heights[kind];
    return { kind, ford, height };
  }

  /** Hauteur du sol sous un point (pour poser personnages, objets et décor). */
  /** Hauteur de la surface de l'eau dessinée sous un point, ou `null` hors de l'eau (bouchon, ronds dans l'eau). */
  waterLevelAt(x: number, y: number): number | null {
    const look = this.look(Math.floor(x), Math.floor(y));
    if (look.kind !== 'water') {
      return null;
    }
    return look.ford ? SETTINGS.fordBed + SETTINGS.waveAmplitude * 2 : SETTINGS.waterSurface;
  }

  heightAt(x: number, y: number): number {
    for (const rect of this.floorRects) {
      if (inRect(rect, x, y)) {
        return rect.height;
      }
    }
    const look = this.look(Math.floor(x), Math.floor(y));
    if (look.kind === 'water') {
      return look.ford ? SETTINGS.fordBed : SETTINGS.waterSurface;
    }
    return look.height;
  }

  /** Vrai si l'herbe pousse là (touffes, fleurs, arbres du pourtour). */
  isGrass(cx: number, cy: number): boolean {
    return this.look(cx, cy).kind === 'grass';
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
        return hash2(cx, cy) < COBBLE_DARK_CHANCE ? 'ballast' : 'sand';
      case 'wood':
        return cx % 2 === 0 ? 'wood' : 'wood_dark';
      case 'floor':
        return cy % 2 === 0 ? 'wood_new' : 'wood';
      case 'water':
        return look.ford ? 'cobble_dark' : 'water_deep';
      case 'rail':
        return hash2(cx, cy) < COBBLE_DARK_CHANCE ? 'ballast_dark' : 'ballast';
      case 'stone':
        return hash2(cx, cy) < COBBLE_DARK_CHANCE ? 'cobble_dark' : 'cobble';
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

  private buildGround(): BufferGeometry {
    const writer = new GeometryWriter();
    const up = [0, 1, 0] as const;
    const ringHeight = -SETTINGS.outerDrop;
    for (let cy = -this.ext; cy < this.map.height + this.ext; cy += 1) {
      // Dessus: les cases voisines de même aspect sont fusionnées en bandes (moins de triangles).
      let runStart = -this.ext;
      let runCell: PaletteCell | null = null;
      let runHeight = 0;
      for (let cx = -this.ext; cx <= this.map.width + this.ext; cx += 1) {
        const atEnd = cx === this.map.width + this.ext;
        const look = atEnd ? null : this.look(cx, cy);
        const cell = look === null ? null : this.topCell(look, cx, cy);
        const fills = look === null ? null : this.roundedCorners(cx, cy, look);
        if (
          runCell !== null &&
          (look === null || fills !== null || cell !== runCell || look.height !== runHeight)
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
          this.roundedTop(writer, cx, cy, look.height, cell, fills);
          continue;
        }
        if (look !== null && cell !== null && runCell === null) {
          runStart = cx;
          runCell = cell;
          runHeight = look.height;
        }
      }
      // Côtés: une marche là où le voisin est plus bas; au bord de la bande, on ferme vers le pourtour.
      for (let cx = -this.ext; cx < this.map.width + this.ext; cx += 1) {
        const look = this.look(cx, cy);
        const h = look.height;
        for (const side of SIDES) {
          const outside = !this.insideBand(cx + side.dx, cy + side.dy);
          const neighbourHeight = outside
            ? ringHeight
            : this.look(cx + side.dx, cy + side.dy).height;
          if (neighbourHeight === h || (!outside && neighbourHeight > h)) {
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
    return writer.build();
  }

  private buildWater(): BufferGeometry {
    const writer = new GeometryWriter();
    const up = [0, 1, 0] as const;
    const steps = SETTINGS.waterSubdivisions;
    const size = 1 / steps;
    for (let cy = -this.ext; cy < this.map.height + this.ext; cy += 1) {
      for (let cx = -this.ext; cx < this.map.width + this.ext; cx += 1) {
        const look = this.look(cx, cy);
        if (look.kind !== 'water') {
          continue;
        }
        const h = look.ford ? SETTINGS.fordBed + SETTINGS.waveAmplitude * 2 : SETTINGS.waterSurface;
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
    return writer.build();
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
