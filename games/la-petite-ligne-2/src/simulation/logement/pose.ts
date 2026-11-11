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
import { isObjectPresent } from '../lieux/presents';
import type { PlaceLook } from '../lieux/verrous';
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

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Deux morceaux d'un logement se touchent à travers une cloison ou un mur d'un mètre. */
const WALL_GAP = 1.5;

function rectGap(a: Rect, b: Rect): number {
  const dx = Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w));
  const dy = Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h));
  return Math.max(dx, dy);
}

function rectDistance(r: Rect, x: number, y: number): number {
  const dx = Math.max(0, r.x - x, x - (r.x + r.w));
  const dy = Math.max(0, r.y - y, y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/**
 * Le morceau du logement autour d'un point: les pièces présentes et le jardin qui se touchent.
 * Un logement peut tenir en plusieurs morceaux éloignés sur la carte du lieu (rez-de-chaussée,
 * étage et cave sont des intérieurs séparés, le jardin est dehors): on y marche de l'un à
 * l'autre par une porte, jamais d'une traite. Le mode déco montre un morceau, et le passage
 * libre se juge dans un morceau. Hors de tout morceau: le plus proche.
 */
export function housingPart(
  housing: HousingDef,
  hstate: DeepReadonly<HousingState> | undefined,
  x: number,
  y: number,
): Rect[] {
  const rects: Rect[] = housing.rooms
    .filter((room) => roomState(room, hstate) !== 'absent')
    .map((room) => room.area);
  if (housing.garden !== null) rects.push(housing.garden);
  let start: Rect | null = null;
  let best = Number.POSITIVE_INFINITY;
  for (const rect of rects) {
    const d = rectDistance(rect, x, y);
    if (d < best) {
      best = d;
      start = rect;
    }
  }
  if (start === null) return [];
  const part = [start];
  for (let grown = true; grown;) {
    grown = false;
    for (const rect of rects) {
      if (part.includes(rect) || !part.some((other) => rectGap(rect, other) <= WALL_GAP)) continue;
      part.push(rect);
      grown = true;
    }
  }
  return part;
}

/** Boîte d'un morceau, murs compris (un mètre autour). */
function partBox(part: readonly Rect[]): Box {
  let box: Box | null = null;
  for (const rect of part) {
    const r = rectBox(rect);
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
  if (box === null) return { x0: 0, y0: 0, x1: 0, y1: 0 };
  return { x0: box.x0 - 1, y0: box.y0 - 1, x1: box.x1 + 1, y1: box.y1 + 1 };
}

/**
 * Meubles en place dans l'emprise du logement, sauf ceux de `exclude` (le meuble en main).
 * `only`: ne garder que ceux d'une boîte (un morceau du logement) et, avec `look`, que les
 * meubles de carte présents (un meuble conditionné absent n'encombre rien).
 */
export function presentProps(
  content: Content,
  place: PlaceContent,
  state: ReadPlace,
  housing: HousingDef,
  exclude: ReadonlySet<string>,
  only?: { readonly within: Box; readonly look: PlaceLook },
): Present[] {
  const zone = only?.within ?? zoneBox(housing);
  const out: Present[] = [];
  const consider = (instance: PropInstance): void => {
    if (exclude.has(instance.id)) return;
    const def = content.props[instance.type];
    if (def === undefined) return;
    const box = boxOf(def, instance);
    if (overlaps(box, zone)) out.push({ instance, def, box });
  };
  for (const object of place.map.objects)
    if (only === undefined || isObjectPresent(only.look, object)) consider(object);
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

/** Un côté du lit touche-t-il une case d'une de ces composantes ? */
function bedReached(
  labels: Int32Array,
  wanted: ReadonlySet<number>,
  cellOf: (x: number, y: number) => number,
  bed: Box,
  step: number,
): boolean {
  const hit = (x: number, y: number): boolean => {
    const cell = cellOf(x, y);
    return cell >= 0 && wanted.has(labels[cell] ?? -1);
  };
  for (let x = bed.x0 + step / 2; x < bed.x1; x += step)
    if (hit(x, bed.y0 - step / 2) || hit(x, bed.y1 + step / 2)) return true;
  for (let y = bed.y0 + step / 2; y < bed.y1; y += step)
    if (hit(bed.x0 - step / 2, y) || hit(bed.x1 + step / 2, y)) return true;
  return false;
}

/**
 * Passage libre dans un morceau du logement, sur une grille au pas de pose, sans traverser murs
 * ni meubles solides au sol: le meuble à poser ne coupe rien de ce qui communiquait. Deux portes
 * qu'on reliait à pied restent reliées; un lit dont on atteignait un côté depuis une porte le
 * garde; un lit qu'on pose doit avoir un côté atteignable. Juger « par rapport à avant » compte:
 * une pièce encore en ruine, une trappe sous les gravats ne se rejoignent pas, sans que ce soit
 * la faute du meuble.
 */
export function pathStaysFree(
  housing: HousingDef,
  hstate: DeepReadonly<HousingState> | undefined,
  fixed: { readonly fixed: Uint8Array; readonly width: number; readonly height: number },
  within: Box,
  solids: readonly Box[],
  beds: readonly Box[],
  candidate: { readonly box: Box; readonly bed: boolean },
): boolean {
  const step = HOUSING_TUNING.gridStep;
  const { x0, y0 } = within;
  const doors = [housing.entrance, ...housing.doors].filter((d) => containsPoint(within, d.x, d.y));
  const cols = Math.ceil((within.x1 - x0) / step);
  const rows = Math.ceil((within.y1 - y0) / step);
  const centre = (i: number, origin: number): number => origin + (i + 0.5) * step;
  const cellOf = (x: number, y: number): number => {
    const c = Math.floor((x - x0) / step);
    const r = Math.floor((y - y0) / step);
    return c < 0 || r < 0 || c >= cols || r >= rows ? -1 : r * cols + c;
  };
  /** Composante de chaque case (-1: on n'y marche pas), meubles solides `blocks` posés. */
  const label = (blocks: readonly Box[]): Int32Array => {
    const labels = new Int32Array(cols * rows).fill(-1);
    const walk = new Uint8Array(cols * rows);
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
        if (blocks.some((b) => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1)) continue;
        walk[r * cols + c] = 1;
      }
    }
    let next = 0;
    const queue: number[] = [];
    for (let start = 0; start < walk.length; start++) {
      if (walk[start] !== 1 || labels[start] !== -1) continue;
      labels[start] = next;
      queue.push(start);
      while (queue.length > 0) {
        const cell = queue.pop() ?? 0;
        const c = cell % cols;
        const r = (cell - c) / cols;
        const around = [
          c > 0 ? cell - 1 : -1,
          c < cols - 1 ? cell + 1 : -1,
          r > 0 ? cell - cols : -1,
          r < rows - 1 ? cell + cols : -1,
        ];
        for (const n of around)
          if (n >= 0 && walk[n] === 1 && labels[n] === -1) {
            labels[n] = next;
            queue.push(n);
          }
      }
      next += 1;
    }
    return labels;
  };
  const before = label(solids);
  const after = label([...solids, candidate.box]);
  const doorCells = doors.map((d) => cellOf(d.x, d.y)).filter((cell) => cell >= 0);
  const at = (labels: Int32Array, cell: number): number => labels[cell] ?? -1;
  for (let i = 0; i < doorCells.length; i++) {
    const a = doorCells[i] ?? -1;
    if (at(before, a) < 0) continue;
    if (at(after, a) < 0) return false;
    for (let j = i + 1; j < doorCells.length; j++) {
      const b = doorCells[j] ?? -1;
      if (at(before, a) === at(before, b) && at(after, a) !== at(after, b)) return false;
    }
  }
  const fromDoors = (labels: Int32Array): Set<number> =>
    new Set(doorCells.map((cell) => at(labels, cell)).filter((l) => l >= 0));
  const reachBefore = fromDoors(before);
  const reachAfter = fromDoors(after);
  for (const bed of beds)
    if (
      bedReached(before, reachBefore, cellOf, bed, step) &&
      !bedReached(after, reachAfter, cellOf, bed, step)
    )
      return false;
  return !candidate.bed || bedReached(after, reachAfter, cellOf, candidate.box, step);
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

  // Seul compte le morceau du logement où l'on pose (rez-de-chaussée, étage, cave, jardin): le
  // reste de la carte du lieu, et les meubles conditionnés absents, n'encombrent rien ici.
  const within = partBox(housingPart(housing, hstate, candidate.x, candidate.y));
  const others = presentProps(content, place, state, housing, q.exclude, {
    within,
    look: { content, world },
  });
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
    const beds = others.filter((o) => functionsOf(o.def).includes('sleep')).map((o) => o.box);
    const candidateBed = { box, bed: functionsOf(def).includes('sleep') };
    if (!pathStaysFree(housing, hstate, blockers, within, solids, beds, candidateBed))
      return 'blocks-path';
  }
  return null;
}
