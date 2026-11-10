/**
 * Le plan d'une pièce pour le rendu (ADR 0023): ses quatre murs avec leurs vides (portes aux
 * seuils, fenêtres déclarées par la pièce ou déduites des façades de son bâtiment), ses cloisons,
 * ses appliques et ses tapis. Tout vient des données: la pièce, les seuils du lieu, le manifeste
 * des bâtiments, les meubles posés contre les murs, et le style choisi par son champ `style`.
 * Aucune pièce ni aucun bâtiment n'est nommé ici. Logique pure, sans Three.js.
 */
import type { Sill } from '../../donnees/seuils';
import type { Lamp } from '../encre/matiere';
import { ROOM_SETTINGS, roomStyle, type RoomSettings, type RoomStyle } from './reglages-pieces';
import { TILE_SETTINGS, type TileSettings } from './reglages-tuiles';
import type { InteriorRect } from './terrain-rendu';

/** Côtés d'une pièce, dans le sens des aiguilles d'une montre (un quart de tour: le suivant). */
export const ROOM_SIDES = ['nord', 'est', 'sud', 'ouest'] as const;
export type RoomSide = (typeof ROOM_SIDES)[number];

/** Normale vers le dehors de chaque côté (x est, z sud). */
export const SIDE_NORMAL: Readonly<Record<RoomSide, readonly [number, number]>> = {
  nord: [0, -1],
  est: [1, 0],
  sud: [0, 1],
  ouest: [-1, 0],
};

/** Fenêtre déclarée par une pièce: son mur et sa place le long de ce mur (m depuis le coin nord ou ouest). */
export interface RoomWindowDef {
  readonly side: RoomSide;
  readonly at: number;
  readonly width?: number;
  readonly sill?: number;
  readonly height?: number;
}

/** Tapis déclaré par une pièce (cases de la pièce, m). */
export interface RoomRugDef {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly color?: string;
}

/** Ce que le rendu lit d'un intérieur (`InteriorDef`): son emprise, ses cloisons, son style. */
export interface RoomDef extends InteriorRect {
  /** Style de la pièce (`ROOM_STYLES`); absent ou inconnu: le style par défaut. */
  readonly style?: string;
  /** Fenêtres imposées: elles remplacent celles déduites des façades (liste vide: aucune). */
  readonly windows?: readonly RoomWindowDef[];
  readonly rugs?: readonly RoomRugDef[];
}

/** Fenêtre d'une façade, dans le repère du bâtiment (m depuis le milieu de l'emprise). */
export interface FacadeWindow {
  readonly x: number;
  readonly z: number;
  readonly nx: number;
  readonly nz: number;
  readonly width: number;
  readonly sill: number;
  readonly height: number;
}

/** Les façades du bâtiment d'une pièce: emprise, fenêtres, quarts de tour du bâtiment vers la pièce. */
export interface RoomFacade {
  readonly width: number;
  readonly depth: number;
  readonly windows: readonly FacadeWindow[];
  readonly turns: 0 | 1 | 2 | 3;
}

/** Fiche d'un bâtiment livré, telle que le manifeste la donne. */
export interface BuildingSheet {
  readonly width: number;
  readonly depth: number;
  /** Façade de la porte d'entrée, `null` sans porte. */
  readonly door: RoomSide | null;
  readonly windows: readonly FacadeWindow[];
}

/** Emprise au sol (m, repère du lieu) de ce qui masque un mur: un meuble haut posé contre lui. */
export interface RoomObstacle {
  readonly x0: number;
  readonly z0: number;
  readonly x1: number;
  readonly z1: number;
  readonly height: number;
}

/** Vide d'un mur: `u` le long du mur (m depuis son coin nord ou ouest, côté pièce), `y` en hauteur. */
export interface RoomOpening {
  readonly kind: 'door' | 'window';
  readonly u0: number;
  readonly u1: number;
  readonly y0: number;
  readonly y1: number;
}

export interface RoomWallPlan {
  readonly side: RoomSide;
  /** Normale vers le dehors. */
  readonly nx: number;
  readonly nz: number;
  /** Longueur du nu intérieur (m): `u` va de 0 à `length`. */
  readonly length: number;
  readonly openings: readonly RoomOpening[];
  /** Appliques: leur place le long du mur. */
  readonly lamps: readonly number[];
}

export interface RoomRect {
  readonly x0: number;
  readonly z0: number;
  readonly x1: number;
  readonly z1: number;
}

export interface RoomPlan {
  readonly id: string;
  readonly style: RoomStyle;
  /** Nu intérieur des murs (m, repère du lieu). */
  readonly x0: number;
  readonly z0: number;
  readonly x1: number;
  readonly z1: number;
  /** Épaisseur des murs (m). */
  readonly thickness: number;
  readonly walls: readonly RoomWallPlan[];
  /** Cloisons coupées (emprises au sol). */
  readonly partitions: readonly RoomRect[];
  readonly rugs: readonly (RoomRect & { readonly color: string })[];
  /** Foyers des appliques, pour la lumière encrée. */
  readonly lamps: readonly Lamp[];
}

/** Un point (`u` le long du mur, `v` vers le dehors depuis le nu intérieur) dans le repère du lieu. */
export function wallPoint(
  plan: Pick<RoomPlan, 'x0' | 'z0' | 'x1' | 'z1'>,
  side: RoomSide,
  u: number,
  v: number,
): { x: number; z: number } {
  switch (side) {
    case 'nord':
      return { x: plan.x0 + u, z: plan.z0 - v };
    case 'sud':
      return { x: plan.x0 + u, z: plan.z1 + v };
    case 'ouest':
      return { x: plan.x0 - v, z: plan.z0 + u };
    case 'est':
      return { x: plan.x1 + v, z: plan.z0 + u };
  }
}

type Span = readonly [number, number];

function overlaps(a: Span, b: Span): boolean {
  return a[0] < b[1] && b[0] < a[1];
}

function sideOfNormal(nx: number, nz: number): RoomSide {
  if (Math.abs(nx) > Math.abs(nz)) return nx > 0 ? 'est' : 'ouest';
  return nz > 0 ? 'sud' : 'nord';
}

function turned(side: RoomSide, turns: number): RoomSide {
  return ROOM_SIDES[(ROOM_SIDES.indexOf(side) + turns) % 4] ?? side;
}

/** Portée d'un rectangle le long d'un mur, s'il le touche à moins de `reach` mètres; sinon `null`. */
function spanAlong(room: RoomRect, side: RoomSide, rect: RoomRect, reach: number): Span | null {
  const alongX = side === 'nord' || side === 'sud';
  const gap =
    side === 'nord'
      ? rect.z0 - room.z0
      : side === 'sud'
        ? room.z1 - rect.z1
        : side === 'ouest'
          ? rect.x0 - room.x0
          : room.x1 - rect.x1;
  if (gap > reach) return null;
  return alongX ? [rect.x0 - room.x0, rect.x1 - room.x0] : [rect.z0 - room.z0, rect.z1 - room.z0];
}

/** Fenêtres voulues sur un mur, avant le contrôle de la place libre: milieu, largeur, appui, hauteur. */
interface Wanted {
  readonly side: RoomSide;
  readonly at: number;
  readonly width: number;
  readonly sill: number;
  readonly height: number;
}

function wantedWindows(room: RoomDef, style: RoomStyle, facade: RoomFacade | null): Wanted[] {
  const w = style.windows;
  const lengthOf = (side: RoomSide): number =>
    side === 'nord' || side === 'sud' ? room.width : room.height;
  if (room.windows !== undefined)
    return room.windows.map((d) => ({
      side: d.side,
      at: d.at,
      width: d.width ?? w.width,
      sill: d.sill ?? w.sill,
      height: d.height ?? w.height,
    }));
  if (w.rule === 'aucune') return [];
  const out: Wanted[] = [];
  if (facade !== null) {
    for (const f of facade.windows) {
      // Une baie trop haute pour la pièce (claire-voie d'une nef) n'est pas une fenêtre d'ici.
      if (f.sill + 0.6 > style.height - 0.25) continue;
      const side = turned(sideOfNormal(f.nx, f.nz), facade.turns);
      const alongX = Math.abs(f.nz) > Math.abs(f.nx);
      // Le long de la façade, depuis son milieu, dans le sens du mur de la pièce après rotation.
      let offset = alongX ? f.x : f.z;
      if (facade.turns === 2 || (facade.turns === 1 && !alongX) || (facade.turns === 3 && alongX))
        offset = -offset;
      const span = alongX ? facade.width : facade.depth;
      const length = lengthOf(side);
      out.push({
        side,
        at: length / 2 + (offset * length) / Math.max(1, span),
        width: Math.min(f.width, w.width * 1.4),
        sill: f.sill,
        height: Math.min(f.height, style.height - 0.25 - f.sill),
      });
    }
    if (out.length > 0) return out;
  }
  // Sans façade connue: une fenêtre au milieu de chaque travée.
  for (const side of ROOM_SIDES) {
    const length = lengthOf(side);
    const count = length < w.bay * 0.7 ? 0 : Math.max(1, Math.round(length / w.bay));
    for (let i = 0; i < count; i += 1)
      out.push({
        side,
        at: (length * (i + 0.5)) / count,
        width: w.width,
        sill: w.sill,
        height: Math.min(w.height, style.height - 0.25 - w.sill),
      });
  }
  return out;
}

/**
 * Le plan d'une pièce. `sills`: les seuils du lieu (repère de la carte); `facade`: les façades de
 * son bâtiment (`roomFacades`), `null` si l'on n'en sait rien; `obstacles`: les meubles posés
 * (une fenêtre ou une applique ne se met pas derrière une armoire).
 */
export function roomPlan(
  room: RoomDef,
  sills: readonly Pick<Sill, 'kind' | 'x' | 'y' | 'halfWidth'>[],
  facade: RoomFacade | null = null,
  obstacles: readonly RoomObstacle[] = [],
  style: RoomStyle = roomStyle(room.style),
  settings: RoomSettings = ROOM_SETTINGS,
  tiles: TileSettings = TILE_SETTINGS,
): RoomPlan {
  const x0 = room.at.x;
  const z0 = room.at.y;
  const x1 = x0 + room.width;
  const z1 = z0 + room.height;
  const rect: RoomRect = { x0, z0, x1, z1 };
  const s = tiles.interior;
  const ws = settings.window;

  // Cloisons: chaque rectangle plein de la pièce, aminci en travers de sa rangée. Une case seule
  // suit la rangée (colonne ou ligne) qui porte le plus de cloisons; un massif garde son emprise.
  const blocked = room.blocked ?? [];
  const inColumn = (x: number): number =>
    blocked.reduce((n, r) => n + (x >= r.x && x < r.x + r.w ? r.h : 0), 0);
  const inRow = (y: number): number =>
    blocked.reduce((n, r) => n + (y >= r.y && y < r.y + r.h ? r.w : 0), 0);
  const thin = Math.min(1, settings.partitionThickness);
  const partitions: RoomRect[] = blocked.map((r) => {
    const vertical = r.h > r.w || (r.h === r.w && inColumn(r.x) >= inRow(r.y));
    const cx = x0 + r.x + r.w / 2;
    const cz = z0 + r.y + r.h / 2;
    const w = vertical && r.w === 1 ? thin : r.w;
    const d = !vertical && r.h === 1 ? thin : r.h;
    return { x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2 };
  });

  const wanted = wantedWindows(room, style, facade);
  const lamps: Lamp[] = [];
  const walls: RoomWallPlan[] = ROOM_SIDES.map((side) => {
    const [nx, nz] = SIDE_NORMAL[side];
    const alongX = side === 'nord' || side === 'sud';
    const length = alongX ? room.width : room.height;
    const edge = side === 'nord' ? z0 : side === 'sud' ? z1 : side === 'ouest' ? x0 : x1;
    const openings: RoomOpening[] = [];
    for (const sill of sills) {
      if (sill.kind !== 'wall') continue;
      const across = alongX ? sill.y : sill.x;
      const u = alongX ? sill.x - x0 : sill.y - z0;
      // Le seuil est bien sur ce mur de cette pièce (et non sur celui d'une pièce voisine).
      if (Math.abs(across - edge) > 1e-3 || u < 0 || u > length) continue;
      const half = sill.halfWidth + s.doorJamb;
      openings.push({ kind: 'door', u0: u - half, u1: u + half, y0: 0, y1: s.door.height });
    }
    // Ce qui prend déjà le mur: portes, cloisons qui s'y appuient, meubles hauts posés contre lui.
    const taken: Span[] = openings.map((o) => [o.u0 - ws.margin, o.u1 + ws.margin]);
    for (const p of partitions) {
      const span = spanAlong(rect, side, p, 0.05);
      if (span !== null) taken.push([span[0] - ws.margin, span[1] + ws.margin]);
    }
    const masked: Span[] = [];
    for (const o of obstacles) {
      if (o.height < ws.tallObject) continue;
      if (o.x1 <= x0 || o.x0 >= x1 || o.z1 <= z0 || o.z0 >= z1) continue;
      const span = spanAlong(rect, side, o, 0.75);
      if (span !== null) masked.push([span[0] - 0.08, span[1] + 0.08]);
    }
    const free = (span: Span): boolean =>
      span[0] >= ws.margin &&
      span[1] <= length - ws.margin &&
      !taken.some((t) => overlaps(t, span)) &&
      !masked.some((t) => overlaps(t, span));
    for (const want of wanted) {
      if (want.side !== side || want.height < 0.4) continue;
      for (const shift of ws.shifts) {
        const u = want.at + shift;
        const span: Span = [u - want.width / 2, u + want.width / 2];
        if (!free(span)) continue;
        openings.push({
          kind: 'window',
          u0: span[0],
          u1: span[1],
          y0: want.sill,
          y1: want.sill + want.height,
        });
        taken.push([span[0] - ws.margin, span[1] + ws.margin]);
        break;
      }
    }
    openings.sort((a, b) => a.u0 - b.u0);

    // Appliques: au milieu des pans libres, jamais au-dessus d'une ouverture ni d'un meuble haut.
    const spots: number[] = [];
    if (style.lamps !== null) {
      const lm = settings.lamp;
      const busy: Span[] = [
        ...openings.map((o): Span => [o.u0 - lm.margin, o.u1 + lm.margin]),
        ...masked,
        ...partitions
          .map((p) => spanAlong(rect, side, p, 0.05))
          .filter((span): span is Span => span !== null)
          .map((span): Span => [span[0] - lm.margin, span[1] + lm.margin]),
      ].sort((a, b) => a[0] - b[0]);
      let cursor: number = lm.margin;
      const gaps: Span[] = [];
      for (const b of busy) {
        if (b[0] > cursor) gaps.push([cursor, b[0]]);
        cursor = Math.max(cursor, b[1]);
      }
      if (cursor < length - lm.margin) gaps.push([cursor, length - lm.margin]);
      for (const gap of gaps) {
        if (gap[1] - gap[0] < 0.2 || lamps.length >= lm.max) continue;
        const u = (gap[0] + gap[1]) / 2;
        const at = wallPoint(rect, side, u, -lm.out);
        const every = style.lamps.every;
        if (lamps.some((l) => Math.hypot(l.x - at.x, l.z - at.z) < every)) continue;
        spots.push(u);
        lamps.push({
          x: at.x,
          y: style.lamps.height,
          z: at.z,
          radius: style.lamps.radius,
          // Une applique au mur ne porte pas d'ombre: à hauteur d'homme, celle d'une armoire ou
          // d'une porte barrerait toute la pièce. Une lampe posée sur un meuble en porte une.
          shadow: false,
        });
      }
    }
    return { side, nx, nz, length, openings, lamps: spots };
  });

  const rugs = (room.rugs ?? []).map((r) => ({
    x0: x0 + r.x,
    z0: z0 + r.y,
    x1: x0 + r.x + r.w,
    z1: z0 + r.y + r.h,
    color: r.color ?? settings.rug.color,
  }));
  return {
    id: room.id,
    style,
    x0,
    z0,
    x1,
    z1,
    thickness: s.wallThickness,
    walls,
    partitions,
    rugs,
    lamps,
  };
}

interface DoorLike {
  readonly x: number;
  readonly y: number;
  readonly to: string;
}

/**
 * Les façades de chaque pièce: une pièce tient ses fenêtres du bâtiment dont elle est
 * l'intérieur (`buildings` de la carte), et les pièces qu'on rejoint de là par une porte (étage,
 * cave) sont dans le même bâtiment. Le bâtiment est tourné vers la pièce d'autant de quarts de
 * tour qu'il en faut pour que sa porte d'entrée tombe sur le mur de la porte de la pièce.
 */
export function roomFacades(
  map: {
    readonly buildings?: Readonly<Record<string, { readonly interior: string | null }>> | undefined;
    readonly doors?: Readonly<Record<string, DoorLike>> | undefined;
  },
  rooms: readonly RoomDef[],
  sills: Readonly<Record<string, Pick<Sill, 'kind' | 'x' | 'y'>>>,
  sheetOf: (building: string) => BuildingSheet | null,
): Map<string, RoomFacade> {
  const out = new Map<string, RoomFacade>();
  const doors = map.doors ?? {};
  const roomAt = (x: number, y: number): RoomDef | undefined =>
    rooms.find(
      (r) => x >= r.at.x && y >= r.at.y && x <= r.at.x + r.width && y <= r.at.y + r.height,
    );
  for (const [id, building] of Object.entries(map.buildings ?? {})) {
    const first = rooms.find((r) => r.id === building.interior);
    const sheet = sheetOf(id);
    if (first === undefined || sheet === null) continue;
    // Le mur de la porte qui donne dehors, pour caler le bâtiment sur la pièce.
    let turns: 0 | 1 | 2 | 3 = 0;
    for (const [doorId, door] of Object.entries(doors)) {
      const target = doors[door.to];
      const sill = sills[doorId];
      if (roomAt(door.x, door.y) !== first || target === undefined || sill?.kind !== 'wall')
        continue;
      if (roomAt(target.x, target.y) !== undefined || sheet.door === null) continue;
      const side: RoomSide =
        Math.abs(sill.y - first.at.y) < 1e-3
          ? 'nord'
          : Math.abs(sill.y - first.at.y - first.height) < 1e-3
            ? 'sud'
            : Math.abs(sill.x - first.at.x) < 1e-3
              ? 'ouest'
              : 'est';
      turns = ((ROOM_SIDES.indexOf(side) - ROOM_SIDES.indexOf(sheet.door) + 4) % 4) as
        0 | 1 | 2 | 3;
      break;
    }
    const facade: RoomFacade = {
      width: sheet.width,
      depth: sheet.depth,
      windows: sheet.windows,
      turns,
    };
    const queue = [first];
    while (queue.length > 0) {
      const room = queue.pop();
      if (room === undefined || out.has(room.id)) continue;
      out.set(room.id, facade);
      for (const door of Object.values(doors)) {
        const target = doors[door.to];
        if (roomAt(door.x, door.y) !== room || target === undefined) continue;
        const next = roomAt(target.x, target.y);
        if (next !== undefined && !out.has(next.id)) queue.push(next);
      }
    }
  }
  return out;
}
