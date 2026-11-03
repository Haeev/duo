/**
 * Lecture des bâtiments visitables (`interieurs`), du ru (`ru`) et de ses passages (`ouvrages`) de la
 * carte du level designer (tour 10, ADR 0016; format en section 9 de `docs/jeux/jeu-1/carte-halte.md`),
 * contrôlés à l'exécution.
 */
import {
  type BuildingId,
  type CrossingKind,
  type GameMap,
  type GridFrame,
  HOUSE_BUILDING,
  type MapBuilding,
  type MapCrossing,
  type MapDoor,
  type MapRoom,
  type MapRoomBuild,
  type MapStream,
  type Rect,
  type WallSide,
  inRect,
  mapMaxX,
  mapMaxY,
  mapMinX,
  mapMinY,
} from '../etat/carte';
import type { Cell, PointId, Vec2 } from '../etat/types';
import type { Reader } from './lecteur';

const WALL_SIDES: Readonly<Record<string, WallSide>> = {
  nord: 'north',
  est: 'east',
  sud: 'south',
  ouest: 'west',
};
const CROSSING_KINDS: Readonly<Record<string, CrossingKind>> = {
  ponceau: 'culvert',
  pont: 'bridge',
  passerelle: 'footbridge',
  gue: 'ford',
};

/** Ce dont la lecture a besoin du reste de la carte: la grille (origine comprise) et les points. */
export interface MapFrame extends GridFrame {
  points: Readonly<Record<PointId, Vec2>>;
}

function rectIn(r: Reader, frame: MapFrame): Rect {
  const rect = {
    x: r.at('x').integer(mapMinX(frame)),
    y: r.at('y').integer(mapMinY(frame)),
    w: r.at('w').integer(1),
    h: r.at('h').integer(1),
  };
  if (rect.x + rect.w > mapMaxX(frame) + 1 || rect.y + rect.h > mapMaxY(frame) + 1)
    r.fail('rectangle hors de la carte');
  return rect;
}

function cellIn(r: Reader, frame: MapFrame): Cell {
  return {
    cx: r.at('cx').integer(mapMinX(frame), mapMaxX(frame)),
    cy: r.at('cy').integer(mapMinY(frame), mapMaxY(frame)),
  };
}

function side(r: Reader): WallSide {
  const value = WALL_SIDES[r.string()];
  if (value === undefined) return r.fail('nord, est, sud ou ouest attendu');
  return value;
}

function pointIn(r: Reader, frame: MapFrame): PointId {
  const id = r.string();
  if (!(id in frame.points)) r.fail(`point « ${id} » absent`);
  return id;
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function roomBuild(r: Reader, frame: MapFrame): MapRoomBuild {
  const door = r.at('porte');
  return {
    room: r.at('a_batir').string(),
    footprint: rectIn(r.at('emprise'), frame),
    sharedWall: side(r.at('mur_commun')),
    door: { cell: cellIn(door, frame), from: door.at('vers').string() },
    site: pointIn(r.at('site'), frame),
    shelves: (r.opt('etageres')?.items() ?? []).map((s) => rectIn(s, frame)),
    windows: (r.opt('fenetres')?.items() ?? []).map(side),
  };
}

function room(r: Reader, frame: MapFrame): MapRoom {
  return {
    id: r.at('id').string(),
    name: r.at('nom').string(),
    rect: rectIn(r.at('rect'), frame),
    build: r.has('a_batir') ? roomBuild(r, frame) : null,
  };
}

function door(r: Reader, frame: MapFrame): MapDoor {
  const cell = cellIn(r, frame);
  const outside = cellIn(r.at('dehors'), frame);
  if (Math.abs(cell.cx - outside.cx) + Math.abs(cell.cy - outside.cy) !== 1)
    r.at('dehors').fail('case voisine de la porte attendue');
  return { id: r.at('id').string(), cell, outside, point: pointIn(r.at('point'), frame) };
}

function building(r: Reader, frame: MapFrame): MapBuilding {
  const id = r.at('id').string();
  const rooms = r
    .at('pieces')
    .items()
    .map((p) => room(p, frame));
  if (!rooms.some((p) => p.build === null)) r.at('pieces').fail('une pièce toujours là attendue');
  const roomIds = new Set<string>();
  for (const p of rooms) {
    if (roomIds.has(p.id)) r.at('pieces').fail(`pièce « ${p.id} » en double`);
    roomIds.add(p.id);
  }
  for (const p of rooms) {
    if (p.build !== null && !roomIds.has(p.build.door.from))
      r.at('pieces').fail(`pièce « ${p.build.door.from} » absente (porte de ${p.id})`);
  }
  const doors = r
    .at('portes')
    .items()
    .map((d) => door(d, frame));
  if (doors.length === 0) r.at('portes').fail('au moins une porte attendue');
  const spawnPoint = pointIn(r.at('apparition'), frame);
  const spawn = frame.points[spawnPoint];
  if (
    spawn === undefined ||
    !rooms.some((p) => p.build === null && inRect(p.rect, spawn.x, spawn.y))
  ) {
    return r.at('apparition').fail(`point « ${spawnPoint} » hors des pièces de « ${id} »`);
  }
  const hours = r.at('heures');
  const ambience = r.at('ambiance');
  return {
    id,
    prop: r.at('objet').string(),
    name: r.at('nom').string(),
    rooms,
    closedParts: (r.opt('fermees')?.items() ?? []).map((f) => ({
      id: f.at('id').string(),
      rect: rectIn(f.at('rect'), frame),
    })),
    doors,
    spawn: { x: spawn.x, y: spawn.y },
    spawnPoint,
    hours: hours.isNull() ? null : hours.string(),
    ambience: ambience.isNull() ? null : ambience.string(),
    fixtures: (r.opt('mobilier')?.items() ?? []).map((m) => ({
      id: m.at('id').string(),
      rotation: m.at('rotation').integer(0, 3),
      cells: m
        .at('cases')
        .items()
        .map((cell) => {
          const [cx, cy] = cell.numberList();
          if (
            cx === undefined ||
            cy === undefined ||
            !Number.isInteger(cx) ||
            !Number.isInteger(cy)
          )
            return cell.fail('[cx, cy] attendu');
          return { cx, cy };
        }),
    })),
  };
}

/**
 * Bâtiments visitables de `interieurs`, par identifiant. Contrôles: identifiants uniques, `house`
 * présent, pièces dans la carte, aucune pièce partagée entre deux bâtiments, apparition dans une
 * pièce toujours là, porte devant une case voisine, points connus. Le reste (pièces hors des murs,
 * porte sur le pourtour) est contrôlé par `outils/valider_carte.py`.
 */
export function parseBuildings(list: Reader, frame: MapFrame): Record<BuildingId, MapBuilding> {
  const buildings: Record<BuildingId, MapBuilding> = {};
  const all: { building: BuildingId; rect: Rect }[] = [];
  for (const item of list.items()) {
    const b = building(item, frame);
    if (b.id in buildings) item.at('id').fail(`bâtiment « ${b.id} » en double`);
    for (const p of b.rooms) {
      const other = all.find((o) => o.building !== b.id && overlaps(o.rect, p.rect));
      if (other !== undefined)
        item.at('pieces').fail(`pièce « ${p.id} » partagée avec « ${other.building} »`);
      all.push({ building: b.id, rect: p.rect });
    }
    buildings[b.id] = b;
  }
  if (!(HOUSE_BUILDING in buildings)) list.fail(`bâtiment « ${HOUSE_BUILDING} » absent`);
  return buildings;
}

/** La maisonnette seule, pour une carte d'avant `interieurs` (et la carte de secours). */
export function houseBuilding(
  prop: string,
  house: GameMap['house'],
  spawnPoint: PointId,
  doorPoint: PointId,
): MapBuilding {
  const below: Cell = { cx: house.door.cx, cy: house.door.cy + 1 };
  return {
    id: HOUSE_BUILDING,
    prop,
    name: 'la maisonnette',
    rooms: [{ id: 'house_main', name: 'la pièce', rect: { ...house.room }, build: null }],
    closedParts: [],
    doors: [{ id: 'house_porte', cell: { ...house.door }, outside: below, point: doorPoint }],
    spawn: { ...house.spawn },
    spawnPoint,
    hours: null,
    ambience: null,
    fixtures: [],
  };
}

/** `GameMap.house` lu depuis `buildings.house`: pièce principale, première porte, apparition. */
export function houseFromBuilding(b: MapBuilding, r: Reader): GameMap['house'] {
  const main = b.rooms.find((p) => p.build === null);
  const first = b.doors[0];
  if (main === undefined || first === undefined)
    return r.fail(`bâtiment « ${b.id} »: pièce ou porte absente`);
  return { room: { ...main.rect }, door: { ...first.cell }, spawn: { ...b.spawn } };
}

export function parseStream(r: Reader, frame: MapFrame): MapStream {
  const columns = r
    .at('colonnes')
    .items()
    .map((c) => c.integer(mapMinX(frame), mapMaxX(frame)));
  if (columns.length === 0) r.at('colonnes').fail('au moins une colonne attendue');
  const fromY = r.at('de_y').integer(mapMinY(frame), mapMaxY(frame));
  const toY = r.at('a_y').integer(fromY, mapMaxY(frame));
  return { columns, fromY, toY };
}

export function parseCrossings(list: Reader, frame: MapFrame): MapCrossing[] {
  return list.items().map((o) => {
    const kind = CROSSING_KINDS[o.at('nature').string()];
    if (kind === undefined) return o.at('nature').fail('ponceau, pont, passerelle ou gue attendu');
    const width = o.opt('largeur_m');
    return {
      id: o.at('id').string(),
      kind,
      crosses: o.at('franchit').string(),
      rect: rectIn(o.at('rect'), frame),
      model: o.at('modele').string(),
      widthM: width === null ? null : width.number(),
    };
  });
}
