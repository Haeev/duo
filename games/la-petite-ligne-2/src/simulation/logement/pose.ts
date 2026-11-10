/**
 * Règles de pose du mode déco, pures: la même fonction juge l'aperçu chez chaque joueur (vert ou
 * rouge, avec la raison) et la pose chez l'hôte. Une seule raison par refus, la plus parlante.
 */
import type { Content, PlaceContent } from '../../donnees/charger';
import type { DecoDef, HousingDef, HousingFunction, RoomDef } from '../../donnees/schemas/logement';
import type { PropDef } from '../../donnees/schemas/meuble';
import type { HousingState } from '../../etat/logement';
import { footprintOf, placeBlockers, type PropInstance, type ReadPlace } from '../noyau/obstacles';
import type { DeepReadonly, ReadonlyWorld } from '../../etat/monde';
import { HOUSING_TUNING } from './reglages';

export type PlacementRefusal =
  | 'outside'
  | 'room-not-ready'
  | 'wrong-room'
  | 'wrong-zone'
  | 'wall'
  | 'overlap'
  | 'no-surface'
  | 'no-wall'
  | 'door'
  | 'blocks-path';

export interface Candidate {
  readonly type: string;
  readonly x: number;
  readonly y: number;
  readonly rotation: 0 | 1 | 2 | 3;
}

export interface Box {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

const EPS = 1e-6;

const DEFAULT_DECO: DecoDef = { layer: 'floor', surface: false, where: 'indoor', comfort: 1 };

export function decoOf(def: PropDef): DecoDef {
  return def.deco ?? { ...DEFAULT_DECO, comfort: HOUSING_TUNING.comfort.defaultProp };
}

export function boxOf(def: PropDef, at: { x: number; y: number; rotation: number }): Box {
  const size = footprintOf(def, at.rotation);
  return {
    x0: at.x - size.w / 2,
    y0: at.y - size.h / 2,
    x1: at.x + size.w / 2,
    y1: at.y + size.h / 2,
  };
}

function rectBox(r: { x: number; y: number; w: number; h: number }): Box {
  return { x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h };
}

function inside(inner: Box, outer: Box): boolean {
  return (
    inner.x0 >= outer.x0 - EPS &&
    inner.y0 >= outer.y0 - EPS &&
    inner.x1 <= outer.x1 + EPS &&
    inner.y1 <= outer.y1 + EPS
  );
}

export function overlaps(a: Box, b: Box): boolean {
  return a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.y0 < b.y1 - EPS && b.y0 < a.y1 - EPS;
}

function containsPoint(b: Box, x: number, y: number): boolean {
  return x >= b.x0 - EPS && x <= b.x1 + EPS && y >= b.y0 - EPS && y <= b.y1 + EPS;
}

/** Centre aimanté à la grille: les bords du meuble tombent sur la grille. */
export function snap(value: number, size: number, step: number = HOUSING_TUNING.gridStep): number {
  return Math.round((value - size / 2) / step) * step + size / 2;
}

export function snapCandidate(content: Content, c: Candidate): Candidate {
  const def = content.props[c.type];
  if (def === undefined) return c;
  const size = footprintOf(def, c.rotation);
  return { ...c, x: snap(c.x, size.w), y: snap(c.y, size.h) };
}

/** Fonctions qu'un meuble demande à sa pièce, d'après ses briques. */
export function functionsOf(def: PropDef): HousingFunction[] {
  const out: HousingFunction[] = [];
  for (const brick of def.bricks) {
    if (brick.brick === 'sleep') out.push('sleep');
    else if (brick.brick === 'cook') out.push('cook');
    else if (brick.brick === 'store') out.push('store');
    else if (brick.brick === 'relieve' && brick.need === 'hygiene') out.push('wash');
  }
  return out;
}

export function roomState(def: RoomDef, state: DeepReadonly<HousingState> | undefined): string {
  return state?.rooms[def.id]?.state ?? def.start;
}

/** La pièce qui contient ce point, quel que soit son état. */
export function roomAt(housing: HousingDef, x: number, y: number): RoomDef | null {
  for (const room of housing.rooms) if (containsPoint(rectBox(room.area), x, y)) return room;
  return null;
}

/** Le point est dans le logement (une pièce existante) ou dans son jardin. */
export function inHousing(
  housing: HousingDef,
  state: DeepReadonly<HousingState> | undefined,
  x: number,
  y: number,
): boolean {
  const room = roomAt(housing, x, y);
  if (room !== null) return roomState(room, state) !== 'absent';
  return housing.garden !== null && containsPoint(rectBox(housing.garden), x, y);
}

/** Meuble en place dans le logement (carte ou posé), avec sa fiche. */
interface Present {
  readonly instance: PropInstance;
  readonly def: PropDef;
  readonly box: Box;
}

function zoneBox(housing: HousingDef): Box {
  let box = housing.garden === null ? null : rectBox(housing.garden);
  for (const room of housing.rooms) {
    const r = rectBox(room.area);
    box =
      box === null
        ? r
        : {
            x0: Math.min(box.x0, r.x0),
            y0: Math.min(box.y0, r.y0),
            x1: Math.max(box.x1, r.x1),
            y1: Math.max(box.y1, r.y1),
          };
  }
  return box ?? { x0: 0, y0: 0, x1: 0, y1: 0 };
}

/** Meubles en place dans l'emprise du logement, sauf ceux de `exclude` (le meuble en main). */
export function presentProps(
  content: Content,
  place: PlaceContent,
  state: ReadPlace,
  housing: HousingDef,
  exclude: ReadonlySet<string>,
): Present[] {
  const zone = zoneBox(housing);
  const out: Present[] = [];
  const consider = (instance: PropInstance): void => {
    if (exclude.has(instance.id)) return;
    const def = content.props[instance.type];
    if (def === undefined) return;
    const box = boxOf(def, instance);
    if (overlaps(box, zone)) out.push({ instance, def, box });
  };
  for (const object of place.map.objects) consider(object);
  for (const placed of state.placed) consider(placed);
  return out;
}

/** Les meubles posés sur cette surface (centre dans son emprise, couche `top`). */
export function propsOnTop(
  content: Content,
  state: ReadPlace,
  surface: PropInstance,
): PropInstance[] {
  const def = content.props[surface.type];
  if (def === undefined || !decoOf(def).surface) return [];
  const box = boxOf(def, surface);
  return state.placed.filter((p) => {
    const d = content.props[p.type];
    return (
      p.id !== surface.id &&
      d !== undefined &&
      decoOf(d).layer === 'top' &&
      containsPoint(box, p.x, p.y)
    );
  });
}

function blocksWalk(def: PropDef): boolean {
  return def.solid && decoOf(def).layer === 'floor';
}

/** Les cellules fixes (murs) sous l'emprise. */
function onFixed(fixed: Uint8Array, width: number, height: number, box: Box): boolean {
  for (let cy = Math.floor(box.y0 + EPS); cy < Math.ceil(box.y1 - EPS); cy++)
    for (let cx = Math.floor(box.x0 + EPS); cx < Math.ceil(box.x1 - EPS); cx++)
      if (cx < 0 || cy < 0 || cx >= width || cy >= height || fixed[cy * width + cx] === 1)
        return true;
  return false;
}

/** Côté du mur derrière un objet mural, selon sa rotation (façade au sud: mur au nord). */
function againstWall(box: Box, room: Box, rotation: number): boolean {
  switch (rotation) {
    case 0:
      return Math.abs(box.y0 - room.y0) < EPS;
    case 1:
      return Math.abs(box.x0 - room.x0) < EPS;
    case 2:
      return Math.abs(box.y1 - room.y1) < EPS;
    default:
      return Math.abs(box.x1 - room.x1) < EPS;
  }
}

function doorBox(door: { x: number; y: number }): Box {
  const d = HOUSING_TUNING.doorClearance;
  return { x0: door.x - d, y0: door.y - d, x1: door.x + d, y1: door.y + d };
}

/**
 * Passage libre: depuis la porte d'entrée, on atteint toutes les portes et un côté de chaque lit,
 * sur une grille au pas de pose, sans traverser murs ni meubles solides au sol.
 */
export function pathIsFree(
  housing: HousingDef,
  hstate: DeepReadonly<HousingState> | undefined,
  fixed: { readonly fixed: Uint8Array; readonly width: number; readonly height: number },
  solids: readonly Box[],
  beds: readonly Box[],
): boolean {
  const step = HOUSING_TUNING.gridStep;
  const zone = zoneBox(housing);
  const doors = [housing.entrance, ...housing.doors];
  const x0 = Math.min(zone.x0, ...doors.map((d) => d.x - 1));
  const y0 = Math.min(zone.y0, ...doors.map((d) => d.y - 1));
  const x1 = Math.max(zone.x1, ...doors.map((d) => d.x + 1));
  const y1 = Math.max(zone.y1, ...doors.map((d) => d.y + 1));
  const cols = Math.ceil((x1 - x0) / step);
  const rows = Math.ceil((y1 - y0) / step);
  const walk = new Uint8Array(cols * rows);
  const centre = (i: number, origin: number): number => origin + (i + 0.5) * step;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = centre(c, x0);
      const y = centre(r, y0);
      const cx = Math.floor(x);
      const cy = Math.floor(y);
      if (cx < 0 || cy < 0 || cx >= fixed.width || cy >= fixed.height) continue;
      if (fixed.fixed[cy * fixed.width + cx] === 1) continue;
      const isDoor = doors.some((d) => Math.abs(d.x - x) <= 0.5 && Math.abs(d.y - y) <= 0.5);
      if (!isDoor) {
        const room = roomAt(housing, x, y);
        if (room !== null) {
          if (roomState(room, hstate) !== 'restored') continue;
        } else if (!inHousing(housing, hstate, x, y)) continue;
      }
      if (
        solids.some((b) => containsPoint(b, x, y) && x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1)
      )
        continue;
      walk[r * cols + c] = 1;
    }
  }
  const cellOf = (x: number, y: number): number => {
    const c = Math.floor((x - x0) / step);
    const r = Math.floor((y - y0) / step);
    return c < 0 || r < 0 || c >= cols || r >= rows ? -1 : r * cols + c;
  };
  const seen = new Uint8Array(cols * rows);
  const start = cellOf(housing.entrance.x, housing.entrance.y);
  if (start < 0 || walk[start] !== 1) return false;
  const queue = [start];
  seen[start] = 1;
  while (queue.length > 0) {
    const cell = queue.pop() ?? 0;
    const c = cell % cols;
    const r = (cell - c) / cols;
    const next = [
      c > 0 ? cell - 1 : -1,
      c < cols - 1 ? cell + 1 : -1,
      r > 0 ? cell - cols : -1,
      r < rows - 1 ? cell + cols : -1,
    ];
    for (const n of next)
      if (n >= 0 && walk[n] === 1 && seen[n] === 0) {
        seen[n] = 1;
        queue.push(n);
      }
  }
  for (const door of doors) {
    const cell = cellOf(door.x, door.y);
    if (cell < 0 || seen[cell] !== 1) return false;
  }
  for (const bed of beds) {
    // Un côté du lit atteignable: une cellule juste autour de l'emprise.
    let reached = false;
    for (let x = bed.x0 + step / 2; x < bed.x1 && !reached; x += step)
      for (const y of [bed.y0 - step / 2, bed.y1 + step / 2]) {
        const cell = cellOf(x, y);
        if (cell >= 0 && seen[cell] === 1) reached = true;
      }
    for (let y = bed.y0 + step / 2; y < bed.y1 && !reached; y += step)
      for (const x of [bed.x0 - step / 2, bed.x1 + step / 2]) {
        const cell = cellOf(x, y);
        if (cell >= 0 && seen[cell] === 1) reached = true;
      }
    if (!reached) return false;
  }
  return true;
}

export interface PlacementQuery {
  readonly content: Content;
  readonly place: PlaceContent;
  readonly state: ReadPlace;
  /** Le monde, pour l'état des verrous du lieu (`placeBlockers`). */
  readonly world: ReadonlyWorld;
  readonly housing: HousingDef;
  readonly candidate: Candidate;
  /** Instances à ignorer: le meuble en main et ce qui est posé dessus. */
  readonly exclude: ReadonlySet<string>;
}

/** Raison du refus de pose, `null`: la place est bonne. */
export function placementRefusal(q: PlacementQuery): PlacementRefusal | null {
  const { content, place, state, world, housing, candidate } = q;
  const def = content.props[candidate.type];
  if (def === undefined) return 'outside';
  const hstate = state.housing?.[housing.id];
  const deco = decoOf(def);
  const box = boxOf(def, candidate);
  const blockers = placeBlockers(content, place, state, world);

  // Zone: une pièce restaurée, ou le jardin pour ce qui va dehors.
  let room: RoomDef | null = null;
  for (const r of housing.rooms) if (inside(box, rectBox(r.area))) room = r;
  if (room !== null) {
    const s = roomState(room, hstate);
    if (s === 'absent') return 'outside';
    if (s !== 'restored') return 'room-not-ready';
    if (deco.where === 'outdoor') return 'wrong-zone';
    const unlocks = room.unlocks;
    if (functionsOf(def).some((f) => !unlocks.includes(f))) return 'wrong-room';
  } else {
    const touchesRoom = housing.rooms.some(
      (r) => roomState(r, hstate) !== 'absent' && overlaps(box, rectBox(r.area)),
    );
    const garden = housing.garden === null ? null : rectBox(housing.garden);
    if (garden === null || !inside(box, garden)) return touchesRoom ? 'wall' : 'outside';
    if (touchesRoom) return 'wall';
    if (deco.where === 'indoor' || deco.layer === 'wall') return 'wrong-zone';
  }
  if (onFixed(blockers.fixed, blockers.width, blockers.height, box)) return 'wall';

  const others = presentProps(content, place, state, housing, q.exclude);
  // Même couche: pas de chevauchement (le tapis passe sous le reste, l'objet va sur une surface).
  for (const other of others) {
    const layer = decoOf(other.def).layer;
    if (layer === deco.layer && overlaps(box, other.box)) return 'overlap';
  }
  if (deco.layer === 'top') {
    const onSurface = others.some(
      (o) => decoOf(o.def).surface && decoOf(o.def).layer === 'floor' && inside(box, o.box),
    );
    if (!onSurface) return 'no-surface';
  } else if (deco.layer === 'floor') {
    // Au sol, rien ne se pose sur un objet de surface d'un autre meuble.
    for (const other of others)
      if (decoOf(other.def).layer === 'top' && overlaps(box, other.box)) return 'overlap';
  }
  if (
    deco.layer === 'wall' &&
    (room === null || !againstWall(box, rectBox(room.area), candidate.rotation))
  )
    return 'no-wall';

  const doors = [housing.entrance, ...housing.doors];
  if (blocksWalk(def) && doors.some((d) => overlaps(box, doorBox(d)))) return 'door';
  if (deco.layer === 'wall' && doors.some((d) => overlaps(box, doorBox(d)))) return 'door';

  if (blocksWalk(def)) {
    const solids = others.filter((o) => blocksWalk(o.def)).map((o) => o.box);
    solids.push(box);
    const beds = others.filter((o) => functionsOf(o.def).includes('sleep')).map((o) => o.box);
    if (functionsOf(def).includes('sleep')) beds.push(box);
    if (!pathIsFree(housing, hstate, blockers, solids, beds)) return 'blocks-path';
  }
  return null;
}
