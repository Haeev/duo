/**
 * Ce que le rendu tire de la carte d'un grand lieu, sans Three.js: la nature dessinée de chaque
 * case, la surface sous les pas, le décor provisoire semé par tuile (arbres, buissons, haies des
 * lisières, cultures, traverses), les rails le long du graphe et les volumes des bâtiments. Tout
 * est déterministe (hachage des coordonnées): les deux machines voient le même bourg.
 */
import { TILE_SIZE, decodeTerrain } from '../../donnees/carte';
import type { MapDef } from '../../donnees/schemas/lieu';
import {
  DEFAULT_LOOK,
  GROUND_LOOKS,
  type GroundLook,
  type SurfaceKind,
  TILE_SETTINGS,
  type TileSettings,
} from './reglages-tuiles';
import { tileRect } from './tuiles';

/** Natures déduites par le rendu, ajoutées après celles de la légende. */
const DERIVED = ['pre', 'cour', 'labour', 'greve'] as const;
/** Ce qui compte comme « aménagé »: le bois s'épaissit loin de tout cela. */
const BUILT = new Set([
  'route',
  'rue',
  'chemin',
  'sentier',
  'voie',
  'ouvrage',
  'eau',
  'batiment',
  'quai',
  'cour',
  'labour',
  'champ',
]);

export interface GroundField {
  readonly width: number;
  readonly height: number;
  /** Nom de chaque nature (légende puis natures déduites) et son rendu. */
  readonly names: readonly string[];
  readonly looks: readonly GroundLook[];
  /** Nature dessinée de chaque case (`y * width + x`). */
  readonly cells: Uint8Array;
  /** Distance (cases, bornée à 255) à la case aménagée la plus proche. */
  readonly wild: Uint8Array;
}

/** Hachage entier de deux coordonnées et d'un sel, de 0 à 1 exclu. */
export function hash01(x: number, y: number, salt = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(salt, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function neighbours4(i: number, width: number, height: number, out: number[]): number[] {
  out.length = 0;
  const x = i % width;
  if (x > 0) out.push(i - 1);
  if (x < width - 1) out.push(i + 1);
  if (i >= width) out.push(i - width);
  if (i < width * (height - 1)) out.push(i + width);
  return out;
}

/** Natures dessinées d'une carte (une carte sans terrain est toute en herbe). */
export function groundField(
  map: Pick<MapDef, 'terrain' | 'width' | 'height'>,
  settings: TileSettings = TILE_SETTINGS,
): GroundField {
  const { width, height } = map;
  const legend = map.terrain?.legend ?? ['herbe'];
  const names = [...legend, ...DERIVED];
  const looks = names.map((name) => GROUND_LOOKS[name] ?? DEFAULT_LOOK);
  const index = (name: string): number => names.indexOf(name);
  const cells = decodeTerrain(map) ?? new Uint8Array(width * height);
  const n = width * height;
  const near: number[] = [];

  // Parcelles (`champ`): leur taille dit ce qu'elles sont (labour, pré, cour de terre battue).
  const champ = index('champ');
  if (champ >= 0) {
    const seen = new Uint8Array(n);
    for (let start = 0; start < n; start++) {
      if (cells[start] !== champ || seen[start] === 1) continue;
      const part: number[] = [start];
      seen[start] = 1;
      // Le tableau grandit pendant le parcours: l'itérateur suit sa longueur (parcours en largeur).
      for (const cell of part)
        for (const j of neighbours4(cell, width, height, near))
          if (cells[j] === champ && seen[j] === 0) {
            seen[j] = 1;
            part.push(j);
          }
      const g = settings.ground;
      const kind =
        part.length >= g.fieldMinCells ? 'labour' : part.length <= g.yardMaxCells ? 'cour' : 'pre';
      const code = index(kind);
      for (const i of part) cells[i] = code;
    }
  }

  // Grève: l'herbe qui borde l'eau.
  const water = index('eau');
  const herbe = index('herbe');
  const greve = index('greve');
  if (water >= 0 && herbe >= 0)
    for (let i = 0; i < n; i++)
      if (cells[i] === herbe && neighbours4(i, width, height, near).some((j) => cells[j] === water))
        cells[i] = greve;

  // Distance à l'aménagé, par vagues depuis toutes les cases aménagées.
  const wild = new Uint8Array(n).fill(255);
  const queue: number[] = [];
  for (let i = 0; i < n; i++)
    if (BUILT.has(names[cells[i] ?? 0] ?? '')) {
      wild[i] = 0;
      queue.push(i);
    }
  for (const i of queue) {
    const d = (wild[i] ?? 0) + 1;
    if (d >= 255) continue;
    for (const j of neighbours4(i, width, height, near))
      if ((wild[j] ?? 0) > d) {
        wild[j] = d;
        queue.push(j);
      }
  }
  return { width, height, names, looks, cells, wild };
}

/** Nature dessinée sous le point (x, y), `null` hors de la carte. */
export function kindAt(field: GroundField, x: number, y: number): string | null {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= field.width || cy >= field.height) return null;
  return field.names[field.cells[cy * field.width + cx] ?? 0] ?? null;
}

/** Ce qu'on entend sous ses pas en (x, y): herbe, terre, pavé... (son des pas). */
export function surfaceAt(field: GroundField, x: number, y: number): SurfaceKind {
  const kind = kindAt(field, x, y);
  return kind === null ? 'herbe' : (GROUND_LOOKS[kind] ?? DEFAULT_LOOK).surface;
}

// ---- Décor semé par tuile ----

/** Boîte posée au sol: centre (x, z), bas `base`, tailles, lacet (radians). */
export interface BoxItem {
  x: number;
  z: number;
  base: number;
  w: number;
  h: number;
  d: number;
  yaw: number;
  color: string;
}
export interface TreeItem {
  x: number;
  z: number;
  trunkRadius: number;
  trunkHeight: number;
  crownRadius: number;
  crownHeight: number;
  color: string;
}
/** Boule (houppier, buisson): centre et demi-tailles. */
export interface BlobItem {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  color: string;
}

export interface TileDecor {
  readonly boxes: BoxItem[];
  readonly trees: TreeItem[];
  readonly bushes: BlobItem[];
}

/** Segments de voie ferrée (m), tirés des arêtes du graphe dont la classe suit une voie. */
export function railSegments(
  map: Pick<MapDef, 'graph'>,
  settings: TileSettings = TILE_SETTINGS,
): [number, number, number, number][] {
  const graph = map.graph;
  if (graph === undefined) return [];
  const kinds: readonly string[] = settings.rail.kinds;
  const out: [number, number, number, number][] = [];
  for (const edge of graph.edges) {
    if (!kinds.includes(edge.kind)) continue;
    const a = graph.nodes[edge.a];
    const b = graph.nodes[edge.b];
    if (a !== undefined && b !== undefined) out.push([a.x, a.y, b.x, b.y]);
  }
  return out;
}

function pick<T>(list: readonly T[], t: number): T {
  const item = list[Math.min(list.length - 1, Math.floor(t * list.length))];
  if (item === undefined) throw new Error('liste vide');
  return item;
}

/** Le décor provisoire d'une tuile (sans bâtiments ni rails, construits à part). */
export function tileDecor(
  field: GroundField,
  map: Pick<MapDef, 'width' | 'height' | 'graph'>,
  tile: number,
  settings: TileSettings = TILE_SETTINGS,
): TileDecor {
  const d = settings.decor;
  const boxes: BoxItem[] = [];
  const trees: TreeItem[] = [];
  const bushes: BlobItem[] = [];
  const { x0, y0, x1, y1 } = tileRect(map, tile);
  const { width, height, names, cells, wild } = field;
  const nameAt = (x: number, y: number): string =>
    x < 0 || y < 0 || x >= width || y >= height ? '' : (names[cells[y * width + x] ?? 0] ?? '');

  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = y * width + x;
      const name = names[cells[i] ?? 0] ?? '';
      const w = wild[i] ?? 255;
      const r = hash01(x, y, 1);
      if (name === 'herbe' || name === 'hors-jeu' || name === 'pre') {
        const share = Math.min(1, Math.max(0, (w - d.wildStart) / (d.wildFull - d.wildStart)));
        const density =
          name === 'hors-jeu'
            ? d.treeOutside
            : name === 'pre'
              ? d.treeSparse
              : d.treeSparse + (d.treeWild - d.treeSparse) * share;
        if (w >= 2 && r < density) {
          const s = 0.75 + hash01(x, y, 2) * 0.6;
          trees.push({
            x: x + 0.2 + hash01(x, y, 3) * 0.6,
            z: y + 0.2 + hash01(x, y, 4) * 0.6,
            trunkRadius: 0.16 * s,
            trunkHeight: 1.7 * s,
            crownRadius: 1.25 * s,
            crownHeight: 1.6 * s,
            color: pick(d.crownColors, hash01(x, y, 5)),
          });
        } else if (name === 'herbe' && w >= 1 && w <= 4 && r > 1 - d.bushNear) {
          const s = 0.35 + hash01(x, y, 6) * 0.35;
          bushes.push({
            x: x + 0.5,
            y: s * 0.7,
            z: y + 0.5,
            rx: s,
            ry: s * 0.8,
            rz: s,
            color: d.bushColor,
          });
        }
      } else if (name === 'labour' && x % 2 === 0) {
        // Rangs de culture, nord-sud.
        boxes.push({
          x: x + 0.5,
          z: y + 0.5,
          base: 0,
          w: 0.45,
          h: 0.25 + hash01(x, y, 7) * 0.15,
          d: 1,
          yaw: 0,
          color: d.cropColor,
        });
      } else if (name === 'lisiere') {
        boxes.push(...edgeDressing(x, y, nameAt, settings));
      }
    }
  sleepersOf(map, tile, settings, boxes);
  return { boxes, trees, bushes };
}

/**
 * Habillage d'une case de lisière (jamais de mur invisible): talus au bord de l'eau, clôture le
 * long de la voie, haie partout ailleurs.
 */
function edgeDressing(
  x: number,
  y: number,
  nameAt: (x: number, y: number) => string,
  settings: TileSettings,
): BoxItem[] {
  const d = settings.decor;
  const around = [nameAt(x - 1, y), nameAt(x + 1, y), nameAt(x, y - 1), nameAt(x, y + 1)];
  const jitter = hash01(x, y, 8);
  if (around.includes('eau'))
    return [
      {
        x: x + 0.5,
        z: y + 0.5,
        base: 0,
        w: 1.05,
        h: d.bankHeight * (0.85 + jitter * 0.3),
        d: 1.05,
        yaw: 0,
        color: d.bankColor,
      },
    ];
  if (around.includes('voie')) {
    const out: BoxItem[] = [
      {
        x: x + 0.5,
        z: y + 0.5,
        base: 0,
        w: 0.12,
        h: d.fenceHeight,
        d: 0.12,
        yaw: 0,
        color: d.fenceColor,
      },
    ];
    // Lisses vers les voisines de lisière à l'est et au sud: la clôture se suit de case en case.
    if (nameAt(x + 1, y) === 'lisiere')
      for (const h of [0.45, 0.85])
        out.push({
          x: x + 1,
          z: y + 0.5,
          base: h,
          w: 1,
          h: 0.07,
          d: 0.05,
          yaw: 0,
          color: d.fenceColor,
        });
    if (nameAt(x, y + 1) === 'lisiere')
      for (const h of [0.45, 0.85])
        out.push({
          x: x + 0.5,
          z: y + 1,
          base: h,
          w: 0.05,
          h: 0.07,
          d: 1,
          yaw: 0,
          color: d.fenceColor,
        });
    return out;
  }
  return [
    {
      x: x + 0.5,
      z: y + 0.5,
      base: 0,
      w: 1.1,
      h: d.hedgeHeight * (0.85 + jitter * 0.3),
      d: 1.1,
      yaw: 0,
      color: d.hedgeColor,
    },
  ];
}

/** Traverses de la tuile, tous les `sleeperStep` m le long des rails. */
function sleepersOf(
  map: Pick<MapDef, 'width' | 'height' | 'graph'>,
  tile: number,
  settings: TileSettings,
  out: BoxItem[],
): void {
  const rail = settings.rail;
  const { x0, y0, x1, y1 } = tileRect(map, tile);
  for (const [ax, ay, bx, by] of railSegments(map, settings)) {
    const length = Math.hypot(bx - ax, by - ay);
    if (length === 0) continue;
    const yaw = Math.atan2(-(by - ay), bx - ax) + Math.PI / 2;
    const steps = Math.floor(length / rail.sleeperStep);
    for (let k = 0; k <= steps; k++) {
      const t = (k * rail.sleeperStep) / length;
      const x = ax + (bx - ax) * t;
      const z = ay + (by - ay) * t;
      if (x < x0 || x >= x1 || z < y0 || z >= y1) continue;
      out.push({
        x,
        z,
        base: 0,
        w: rail.sleeper.w,
        h: rail.sleeper.h,
        d: rail.sleeper.d,
        yaw,
        color: rail.sleeperColor,
      });
    }
  }
}

/** Morceaux de rail (deux files) dont le milieu tombe dans la tuile. */
export function railPieces(
  map: Pick<MapDef, 'width' | 'height' | 'graph'>,
  tile: number,
  settings: TileSettings = TILE_SETTINGS,
): BoxItem[] {
  const rail = settings.rail;
  const { x0, y0, x1, y1 } = tileRect(map, tile);
  const out: BoxItem[] = [];
  for (const [ax, ay, bx, by] of railSegments(map, settings)) {
    const length = Math.hypot(bx - ax, by - ay);
    if (length === 0) continue;
    const ux = (bx - ax) / length;
    const uy = (by - ay) / length;
    const pieces = Math.ceil(length / rail.pieceLength);
    const piece = length / pieces;
    const yaw = Math.atan2(-uy, ux);
    for (let k = 0; k < pieces; k++) {
      const mx = ax + ux * piece * (k + 0.5);
      const my = ay + uy * piece * (k + 0.5);
      if (mx < x0 || mx >= x1 || my < y0 || my >= y1) continue;
      for (const side of [-1, 1])
        out.push({
          x: mx - uy * rail.halfGauge * side,
          z: my + ux * rail.halfGauge * side,
          base: rail.sleeper.h,
          // Un rien plus long: pas de jour entre deux morceaux dans une courbe.
          w: piece + 0.06,
          h: rail.railHeight,
          d: rail.railWidth,
          yaw,
          color: rail.railColor,
        });
    }
  }
  return out;
}

// ---- Bâtiments ----

export type Side = 'north' | 'south' | 'east' | 'west';

export interface BuildingShape {
  readonly id: string;
  /** Boîtes des murs (porte comprise), des fenêtres et lampe, et le toit. */
  readonly walls: BoxItem[];
  readonly glass: BoxItem[];
  readonly roof: {
    cx: number;
    cz: number;
    w: number;
    d: number;
    base: number;
    ridge: number;
    alongX: boolean;
    color: string;
  } | null;
  readonly wallHeight: number;
  readonly doorSide: Side | null;
  readonly rect: { x: number; y: number; w: number; h: number };
}

/** Le côté du rectangle le plus proche de la porte. */
export function doorSideOf(
  rect: { x: number; y: number; w: number; h: number },
  door: { x: number; y: number },
): Side {
  const options: [Side, number][] = [
    ['north', Math.abs(door.y - rect.y)],
    ['south', Math.abs(door.y - (rect.y + rect.h))],
    ['west', Math.abs(door.x - rect.x)],
    ['east', Math.abs(door.x - (rect.x + rect.w))],
  ];
  options.sort((a, b) => a[1] - b[1]);
  return options[0]?.[0] ?? 'south';
}

/**
 * Les volumes d'un bâtiment du plan: quatre murs (ouverture et porte pleine du côté de la porte,
 * marche dehors, lampe au-dessus), fenêtres, toit à deux pans sur le grand côté. Sans porte: une
 * plateforme basse (le quai).
 */
export function buildingShape(
  id: string,
  building: {
    rect: { x: number; y: number; w: number; h: number };
    door: { x: number; y: number } | null;
  },
  settings: TileSettings = TILE_SETTINGS,
): BuildingShape {
  const b = settings.building;
  const { rect } = building;
  const walls: BoxItem[] = [];
  const glass: BoxItem[] = [];
  if (building.door === null) {
    walls.push({
      x: rect.x + rect.w / 2,
      z: rect.y + rect.h / 2,
      base: 0,
      w: rect.w,
      h: b.platformHeight,
      d: rect.h,
      yaw: 0,
      color: b.platformEdgeColor,
    });
    return { id, walls, glass, roof: null, wallHeight: b.platformHeight, doorSide: null, rect };
  }
  const salt = Math.floor(hash01(rect.x, rect.y, 11) * 1000);
  const wallColor = pick(b.wallColors, hash01(salt, 1, 12));
  const roofColor = pick(b.roofColors, hash01(salt, 2, 13));
  const short = Math.min(rect.w, rect.h);
  const height = Math.min(b.wallMax, b.wallBase + b.wallPerMeter * short);
  const t = b.wallThickness;
  const side = doorSideOf(rect, building.door);
  const doorAt = side === 'north' || side === 'south' ? building.door.x : building.door.y;

  // Un mur: de `from` à `to` le long de son axe, à la position `fixed` sur l'autre axe.
  const wall = (s: Side, from: number, to: number, base: number, h: number): void => {
    if (to - from <= 0.01) return;
    const along = s === 'north' || s === 'south';
    const fixed =
      s === 'north'
        ? rect.y + t / 2
        : s === 'south'
          ? rect.y + rect.h - t / 2
          : s === 'west'
            ? rect.x + t / 2
            : rect.x + rect.w - t / 2;
    walls.push({
      x: along ? (from + to) / 2 : fixed,
      z: along ? fixed : (from + to) / 2,
      base,
      w: along ? to - from : t,
      h,
      d: along ? t : to - from,
      yaw: 0,
      color: wallColor,
    });
  };
  const sides: Side[] = ['north', 'south', 'west', 'east'];
  for (const s of sides) {
    const along = s === 'north' || s === 'south';
    // Les murs nord et sud courent sur toute la largeur, l'est et l'ouest entre eux.
    const from = along ? rect.x : rect.y + t;
    const to = along ? rect.x + rect.w : rect.y + rect.h - t;
    const outward = s === 'north' || s === 'west' ? -1 : 1;
    const fixedOut =
      s === 'north'
        ? rect.y
        : s === 'south'
          ? rect.y + rect.h
          : s === 'west'
            ? rect.x
            : rect.x + rect.w;
    const put = (
      a: number,
      w: number,
      h: number,
      base: number,
      depth: number,
      color: string,
      list: BoxItem[],
    ): void => {
      list.push({
        x: along ? a : fixedOut + (outward * depth) / 2,
        z: along ? fixedOut + (outward * depth) / 2 : a,
        base,
        w: along ? w : Math.abs(depth),
        h,
        d: along ? Math.abs(depth) : w,
        yaw: 0,
        color,
      });
    };
    let gap: [number, number] | null = null;
    if (s === side) {
      const half = b.door.width / 2;
      const center = Math.min(to - half - 0.2, Math.max(from + half + 0.2, doorAt));
      gap = [center - half, center + half];
      wall(s, from, gap[0], 0, height);
      wall(s, gap[1], to, 0, height);
      wall(s, gap[0], gap[1], b.door.height, height - b.door.height);
      // Porte pleine, en retrait dans l'épaisseur du mur; marche et lampe dehors.
      const inner =
        s === 'north'
          ? rect.y + t * 0.6
          : s === 'south'
            ? rect.y + rect.h - t * 0.6
            : s === 'west'
              ? rect.x + t * 0.6
              : rect.x + rect.w - t * 0.6;
      walls.push({
        x: along ? center : inner,
        z: along ? inner : center,
        base: 0,
        w: along ? b.door.width : 0.1,
        h: b.door.height,
        d: along ? 0.1 : b.door.width,
        yaw: 0,
        color: b.door.color,
      });
      put(center, b.door.width + 0.4, 0.12, 0, 0.6, b.door.stepColor, walls);
      put(center, b.lamp.size, b.lamp.size, b.door.height + 0.3, 0.3, b.lamp.color, glass);
    } else wall(s, from, to, 0, height);
    // Fenêtres régulières, loin des coins et de la porte.
    const span = to - from;
    const count = Math.floor((span - 1.2) / b.window.spacing);
    for (let k = 0; k < count; k++) {
      const a = from + (span - (count - 1) * b.window.spacing) / 2 + k * b.window.spacing;
      if (
        gap !== null &&
        a + b.window.width / 2 > gap[0] - 0.4 &&
        a - b.window.width / 2 < gap[1] + 0.4
      )
        continue;
      put(a, b.window.width, b.window.height, b.window.sill, 0.06, b.window.color, glass);
    }
  }
  const alongX = rect.w >= rect.h;
  const roof = {
    cx: rect.x + rect.w / 2,
    cz: rect.y + rect.h / 2,
    w: rect.w + b.overhang * 2,
    d: rect.h + b.overhang * 2,
    base: height,
    ridge: Math.min(b.ridgeMax, short * b.ridgeShare),
    alongX,
    color: roofColor,
  };
  return { id, walls, glass, roof, wallHeight: height, doorSide: side, rect };
}

/** Bâtiments rangés par tuile (celle de leur centre). */
export function buildingsByTile(
  map: Pick<MapDef, 'width' | 'height' | 'buildings'>,
  settings: TileSettings = TILE_SETTINGS,
): Map<number, BuildingShape[]> {
  const out = new Map<number, BuildingShape[]>();
  const cols = Math.ceil(map.width / TILE_SIZE);
  for (const [id, building] of Object.entries(map.buildings ?? {})) {
    const cx = building.rect.x + building.rect.w / 2;
    const cy = building.rect.y + building.rect.h / 2;
    const tile = Math.floor(cy / TILE_SIZE) * cols + Math.floor(cx / TILE_SIZE);
    const list = out.get(tile) ?? [];
    list.push(buildingShape(id, building, settings));
    out.set(tile, list);
  }
  return out;
}
