/**
 * Un véhicule de voie sur ses rails: où il est posé (sur sa voie ou dans sa remise), où sont ses
 * places, jusqu'où il peut rouler. Fonctions pures, tirées de la fiche, de la carte et de l'état
 * transmis: l'hôte, la visée de l'invité et le rendu trouvent la même pose. Le tracé et la pose
 * le long des rails sont ceux des trains (`monde/trains.ts`).
 */
import type { PlaceContent } from '../../donnees/charger';
import type { RailVehicleDef, TrackSpot, VehicleSeat } from '../../donnees/schemas/vehicule';
import type { DeepReadonly } from '../../etat/monde';
import type { RailVehicleState } from '../../etat/vehicules';
import { isLockDefOpen, locksOf, type PlaceLook } from '../lieux/verrous';
import {
  pointOn,
  poseOnTrack,
  project,
  trackOf,
  type Track,
  type VehiclePose,
} from '../monde/trains';
import { RAIL_VEHICLES, type RailVehicleSettings } from './reglages';

export type ReadVehicle = DeepReadonly<RailVehicleState>;

/** Un endroit de la voie, en mètres depuis son début; `null` si le point manque à la carte. */
export function spotOn(place: PlaceContent, track: Track, spot: TrackSpot): number | null {
  const point = place.map.points[spot.point];
  if (point === undefined) return null;
  return project(track, point.x, point.y) + (spot.shift ?? 0);
}

/** Ce que la fiche donne une fois lue sur la carte: voies, point de pose, butées, arrêts. */
export interface VehicleLine {
  readonly track: Track;
  readonly garage: Track;
  /** Dans la remise: mètres depuis le début de la voie de garage. */
  readonly garageAt: number;
  readonly launch: number;
  readonly from: number;
  readonly to: number;
  readonly stops: readonly { readonly id: string; readonly name: string; readonly s: number }[];
}

const lines = new WeakMap<RailVehicleDef, VehicleLine | null>();

/** La ligne d'un véhicule, lue une fois; `null` si sa voie, sa remise ou un point manque. */
export function lineOf(place: PlaceContent, def: RailVehicleDef): VehicleLine | null {
  const known = lines.get(def);
  if (known !== undefined) return known;
  const track = trackOf(place, def.track);
  const garage = trackOf(place, def.garage.track);
  let line: VehicleLine | null = null;
  if (track !== null && garage !== null) {
    const launch = spotOn(place, track, def.launch);
    const a = spotOn(place, track, def.range.from);
    const b = spotOn(place, track, def.range.to);
    const stops: { id: string; name: string; s: number }[] = [];
    let whole = true;
    for (const stop of def.stops) {
      const s = spotOn(place, track, stop.at);
      if (s === null) whole = false;
      else stops.push({ id: stop.id, name: stop.name, s });
    }
    if (launch !== null && a !== null && b !== null && whole)
      line = {
        track,
        garage,
        garageAt: garage.length + def.garage.inside,
        launch,
        from: Math.min(a, b),
        to: Math.max(a, b),
        stops,
      };
  }
  lines.set(def, line);
  return line;
}

/**
 * Pose le véhicule dans `out`: sur sa voie à `s` mètres (par défaut la position de l'état) s'il
 * est sorti, dans sa remise sinon. L'avant du modèle regarde toujours la fin de la voie: il ne se
 * retourne pas, il repart en arrière. Faux si sa ligne manque à la carte.
 */
export function poseVehicle(
  place: PlaceContent,
  def: RailVehicleDef,
  state: ReadVehicle | undefined,
  out: VehiclePose,
  s: number | undefined = state?.s,
): boolean {
  const line = lineOf(place, def);
  if (line === null) return false;
  out.model = def.model;
  out.front = def.body.front;
  out.back = def.body.back;
  if (state?.out === true && s !== undefined) poseOnTrack(line.track, s, 1, false, out);
  else poseOnTrack(line.garage, line.garageAt, 1, false, out);
  return true;
}

/** La porte de la remise: le dernier point de la voie de garage. */
export function garageDoor(line: VehicleLine, out: { x: number; y: number }): void {
  pointOn(line.garage, line.garage.length, out);
}

export interface Place2 {
  x: number;
  y: number;
  /** Cap du corps: 0 vers l'est, PI/2 vers le sud. */
  facing: number;
}

/**
 * Repère du véhicule vers la carte: `along` vers l'avant du modèle (+z), `side` le long de son
 * +x (à gauche quand on regarde vers l'avant), comme les accroches du manifeste des décors.
 */
function toMap(
  pose: VehiclePose,
  along: number,
  side: number,
  out: { x: number; y: number },
): void {
  const sin = Math.sin(pose.yaw);
  const cos = Math.cos(pose.yaw);
  out.x = pose.x + sin * along + cos * side;
  out.y = pose.y + cos * along - sin * side;
}

/** Où se tient, sur la carte, qui occupe cette place, et vers où il regarde. */
export function seatPlace(pose: VehiclePose, seat: VehicleSeat, out: Place2): void {
  toMap(pose, seat.along, seat.side, out);
  out.facing = Math.PI / 2 - pose.yaw + (seat.faces === 'back' ? Math.PI : 0);
}

/**
 * Où poser qui descend de cette place: à côté du gabarit, du côté `side` (1: +x du modèle, à
 * gauche; -1: à droite), au droit de la place.
 */
export function exitPlace(
  pose: VehiclePose,
  def: RailVehicleDef,
  seat: VehicleSeat,
  side: 1 | -1,
  radius: number,
  out: { x: number; y: number },
  settings: RailVehicleSettings = RAIL_VEHICLES,
): void {
  toMap(pose, seat.along, side * (def.body.halfWidth + radius + settings.exitGap), out);
}

/** Le point du gabarit le plus proche de (x, y): on vise le véhicule par n'importe quel bord. */
export function nearestOnBody(
  pose: VehiclePose,
  def: RailVehicleDef,
  x: number,
  y: number,
  out: { x: number; y: number },
): void {
  const sin = Math.sin(pose.yaw);
  const cos = Math.cos(pose.yaw);
  const dx = x - pose.x;
  const dy = y - pose.y;
  const along = Math.max(-def.body.back, Math.min(def.body.front, dx * sin + dy * cos));
  const half = def.body.halfWidth;
  const side = Math.max(-half, Math.min(half, dx * cos - dy * sin));
  toMap(pose, along, side, out);
}

/** Cases fermées le long d'une voie: celles de la carte, et le verrou d'histoire qui couvre chacune. */
interface Scan {
  readonly step: number;
  readonly count: number;
  /** 1: case bloquée par la carte (bord du lieu, bâtiment). */
  readonly fixed: Uint8Array;
  /** Rang du verrou qui couvre ce point de la voie, -1 sinon. */
  readonly lock: Int16Array;
}

const scans = new WeakMap<Track, Scan>();
const probe = { x: 0, y: 0 };

function scanOf(place: PlaceContent, track: Track, step: number): Scan {
  let scan = scans.get(track);
  if (scan?.step === step) return scan;
  const count = Math.floor(track.length / step) + 1;
  const fixed = new Uint8Array(count);
  const lock = new Int16Array(count).fill(-1);
  const locks = locksOf(place);
  const inside = (r: { x: number; y: number; w: number; h: number }): boolean =>
    probe.x >= r.x && probe.x < r.x + r.w && probe.y >= r.y && probe.y < r.y + r.h;
  for (let i = 0; i < count; i++) {
    pointOn(track, i * step, probe);
    if (place.map.blocked.some(inside)) fixed[i] = 1;
    lock[i] = locks.findIndex(([, def]) => def.rects.some(inside));
  }
  scan = { step, count, fixed, lock };
  scans.set(track, scan);
  return scan;
}

export interface Limits {
  /** Positions extrêmes du centre du véhicule (m depuis le début de la voie). */
  min: number;
  max: number;
}

/** États des verrous relus pendant un appel (-1: pas encore lu). */
const lockStates = new Int8Array(64);

/**
 * Jusqu'où le véhicule peut rouler depuis `s`: entre les butées de sa fiche, et jamais dans une
 * case fermée de la voie (bord de la carte, verrou d'histoire fermé: les ronces, la grille).
 * Les verrous se relisent à chaque appel: un passage ouvert par l'histoire rallonge la ligne.
 */
export function limitsOf(
  look: PlaceLook,
  place: PlaceContent,
  def: RailVehicleDef,
  s: number,
  out: Limits,
  settings: RailVehicleSettings = RAIL_VEHICLES,
): void {
  const line = lineOf(place, def);
  if (line === null) {
    out.min = s;
    out.max = s;
    return;
  }
  const scan = scanOf(place, line.track, settings.scanStep);
  const locks = locksOf(place);
  lockStates.fill(-1);
  const closed = (i: number): boolean => {
    if (scan.fixed[i] === 1) return true;
    const lock = scan.lock[i] ?? -1;
    if (lock < 0 || lock >= lockStates.length) return false;
    if (lockStates[lock] === -1) {
      const def = locks[lock]?.[1];
      lockStates[lock] = def === undefined || isLockDefOpen(look, def) ? 1 : 0;
    }
    return lockStates[lock] === 0;
  };
  const here = Math.max(0, Math.min(scan.count - 1, Math.round(s / scan.step)));
  let max = line.to;
  for (let i = here + 1; i < scan.count && i * scan.step <= line.to + def.body.front; i++)
    if (closed(i)) {
      max = Math.min(max, i * scan.step - def.body.front - settings.clearance);
      break;
    }
  let min = line.from;
  for (let i = here - 1; i >= 0 && i * scan.step >= line.from - def.body.back; i--)
    if (closed(i)) {
      min = Math.max(min, i * scan.step + def.body.back + settings.clearance);
      break;
    }
  out.min = Math.min(min, s);
  out.max = Math.max(max, s);
}

/** L'arrêt de la fiche à moins de `stopReach` de `s`, le plus proche; `null` en pleine voie. */
export function stopAt(line: VehicleLine, def: RailVehicleDef, s: number): string | null {
  let best: string | null = null;
  let bestGap = def.stopReach;
  for (const stop of line.stops) {
    const gap = Math.abs(stop.s - s);
    if (gap <= bestGap) {
      best = stop.id;
      bestGap = gap;
    }
  }
  return best;
}
