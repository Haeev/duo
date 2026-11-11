/**
 * Les trains des événements du calendrier (champ `train` d'un événement): où est chaque véhicule
 * à une heure donnée. Logique pure, tirée de l'heure de jeu, du jour et des conditions de
 * l'événement: l'hôte et l'invité voient la même rame au même endroit, après un chargement en
 * plein événement comme après une nuit sautée. Rien de plus n'est sauvegardé ni transmis.
 *
 * Horaire: la rame arrive en ralentissant (décélération constante) et s'arrête à l'heure `from`
 * de l'événement, reste à quai jusqu'à `to`, puis repart en accélérant. Elle suit le tracé de sa
 * voie (`rails` de la carte), courbes comprises: chaque caisse est posée sur la corde entre ses
 * deux bogies.
 *
 * Simulation: tant qu'elle est là, son emprise bloque les joueurs (`obstacles.ts`); un joueur
 * surpris sur la voie est dégagé sur la case libre la plus proche (`clearTrainPath`).
 */
import type { PlaceContent } from '../../donnees/charger';
import type { MapDef } from '../../donnees/schemas/lieu';
import type { CalendarEventDef, TrainDef } from '../../donnees/schemas/temps';
import type { Look } from '../briques/types';
import { decodeTerrain } from '../../donnees/carte';
import { MINUTES_PER_DAY } from '../noyau/constantes';
import { eventsOn } from './agenda';
import { TRAINS, type TrainSettings } from './reglages-trains';

type RailTrack = NonNullable<MapDef['rails']>[number];

export type TrainPhase = 'arriving' | 'stopped' | 'leaving';

/** Un véhicule posé: centre sur la carte (m), cap (radians, comme `Object3D.rotation.y`). */
export interface VehiclePose {
  model: string;
  x: number;
  y: number;
  /** L'avant du modèle (+z) regarde vers (sin yaw, cos yaw) en (x, y) de la carte. */
  yaw: number;
  front: number;
  back: number;
}

export interface TrainPose {
  /** L'événement qui amène ce train. */
  event: string;
  phase: TrainPhase;
  /** Vrai à l'arrivée et au départ: l'emprise s'allonge devant et derrière. */
  moving: boolean;
  /** Tête de la rame (m, depuis le début de la voie): de quoi suivre son avance. */
  head: number;
  /** Voie suivie (`rails` de la carte). */
  track: string;
  /**
   * Ce que la rame occupe ou va occuper sur sa voie (m depuis son début, `reachFrom` <= `reachTo`):
   * de sa place à celle de son arrêt à l'arrivée, à quai sa seule longueur, au départ jusqu'à la
   * fin de son démarrage. Passages à niveau et habitants le lisent.
   */
  reachFrom: number;
  reachTo: number;
  readonly vehicles: VehiclePose[];
}

/** Voie prête à parcourir: points et longueurs cumulées. */
export interface Track {
  readonly xs: Float64Array;
  readonly ys: Float64Array;
  /** Distance du premier point à chaque point. */
  readonly at: Float64Array;
  readonly length: number;
}

const tracks = new WeakMap<RailTrack, Track>();

/** La voie `id` de la carte du lieu, prête à parcourir (gardée d'un appel à l'autre); `null`: inconnue. */
export function trackOf(place: PlaceContent, id: string): Track | null {
  const rail = place.map.rails?.find((r) => r.id === id);
  if (rail === undefined) return null;
  let track = tracks.get(rail);
  if (track === undefined) {
    const n = rail.points.length;
    const xs = new Float64Array(n);
    const ys = new Float64Array(n);
    const at = new Float64Array(n);
    rail.points.forEach(([x, y], i) => {
      xs[i] = x;
      ys[i] = y;
      if (i > 0) at[i] = (at[i - 1] ?? 0) + Math.hypot(x - (xs[i - 1] ?? 0), y - (ys[i - 1] ?? 0));
    });
    track = { xs, ys, at, length: at[n - 1] ?? 0 };
    tracks.set(rail, track);
  }
  return track;
}

/** Le point de la voie à la distance `s` de son début; au-delà d'un bout, son prolongement droit. */
export function pointOn(track: Track, s: number, out: { x: number; y: number }): void {
  const last = track.at.length - 1;
  let i = 0;
  while (i < last - 1 && (track.at[i + 1] ?? 0) < s) i++;
  const a = track.at[i] ?? 0;
  const span = (track.at[i + 1] ?? a + 1) - a;
  const t = (s - a) / (span > 0 ? span : 1);
  const x0 = track.xs[i] ?? 0;
  const y0 = track.ys[i] ?? 0;
  out.x = x0 + ((track.xs[i + 1] ?? x0) - x0) * t;
  out.y = y0 + ((track.ys[i + 1] ?? y0) - y0) * t;
}

/** Distance, depuis le début de la voie, du point de la voie le plus proche de (x, y). */
export function project(track: Track, x: number, y: number): number {
  let best = Number.POSITIVE_INFINITY;
  let bestS = 0;
  for (let i = 0; i + 1 < track.xs.length; i++) {
    const ax = track.xs[i] ?? 0;
    const ay = track.ys[i] ?? 0;
    const dx = (track.xs[i + 1] ?? ax) - ax;
    const dy = (track.ys[i + 1] ?? ay) - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
    const d = (ax + dx * t - x) ** 2 + (ay + dy * t - y) ** 2;
    if (d < best) {
      best = d;
      bestS = (track.at[i] ?? 0) + Math.sqrt(len2) * t;
    }
  }
  return bestS;
}

function wrap(minutes: number): number {
  return ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** Où en est le train d'un événement à cette heure: phase et chemin restant ou parcouru (m). */
export interface TrainMoment {
  phase: TrainPhase;
  /** Arrivée: mètres qui restent avant l'arrêt; départ: mètres parcourus depuis l'arrêt. */
  run: number;
}

/** Durée à quai (minutes): de `from` à `to`, minuit passé s'il le faut. */
export function dwellOf(event: CalendarEventDef): number {
  return wrap(event.hours.to - event.hours.from);
}

/** La phase du train à l'heure `minutes` (0 à 1440), `null` s'il n'est pas là. */
export function trainMoment(
  event: CalendarEventDef,
  train: TrainDef,
  minutes: number,
  out: TrainMoment,
): TrainMoment | null {
  const rel = wrap(minutes - event.hours.from);
  const arrival = train.arrival;
  const departure = train.departure;
  const dwell = dwellOf(event);
  if (rel >= MINUTES_PER_DAY - arrival.minutes) {
    // Décélération constante: la vitesse tombe à zéro pile à l'arrêt.
    const left = (MINUTES_PER_DAY - rel) / arrival.minutes;
    out.phase = 'arriving';
    out.run = arrival.distance * left * left;
    return out;
  }
  if (rel < dwell) {
    out.phase = 'stopped';
    out.run = 0;
    return out;
  }
  if (rel < dwell + departure.minutes) {
    const done = (rel - dwell) / departure.minutes;
    out.phase = 'leaving';
    out.run = departure.distance * done * done;
    return out;
  }
  return null;
}

const moment: TrainMoment = { phase: 'stopped', run: 0 };
const front = { x: 0, y: 0 };
const rear = { x: 0, y: 0 };

/**
 * Pose un véhicule sur la voie: son centre à `center` mètres du début, l'avant du modèle vers la
 * fin de la voie (`heading` 1) ou vers son début (-1), retourné bout pour bout si `reversed`. La
 * caisse suit la corde entre ses deux bogies, courbes comprises. Écrit `x`, `y` et `yaw` de
 * `pose`, dont `front` et `back` sont déjà posés. Sert aux rames des événements et aux véhicules
 * de voie des joueurs (`simulation/vehicules/`).
 */
export function poseOnTrack(
  track: Track,
  center: number,
  heading: 1 | -1,
  reversed: boolean,
  pose: VehiclePose,
  settings: TrainSettings = TRAINS,
): void {
  const half = ((pose.front + pose.back) / 2) * settings.bogieShare;
  pointOn(track, center + heading * half, front);
  pointOn(track, center - heading * half, rear);
  pose.x = (front.x + rear.x) / 2;
  pose.y = (front.y + rear.y) / 2;
  pose.yaw = Math.atan2(front.x - rear.x, front.y - rear.y) + (reversed ? Math.PI : 0);
}

/** Ce qui précède le centre du véhicule dans le sens de marche de la rame (m). */
function lead(vehicle: TrainDef['consist'][number]): number {
  return vehicle.reversed === true ? vehicle.back : vehicle.front;
}

/**
 * Pose le train d'un événement à l'heure `minutes` dans `out`. Faux s'il n'est pas là (hors de
 * son horaire) ou si sa voie ou son point d'arrêt manque à la carte.
 */
export function poseTrain(
  place: PlaceContent,
  event: CalendarEventDef,
  minutes: number,
  out: TrainPose,
  settings: TrainSettings = TRAINS,
): boolean {
  const train = event.train;
  if (train === undefined) return false;
  const track = trackOf(place, train.track);
  const point = place.map.points[train.stop.point];
  if (track === null || point === undefined) return false;
  const now = trainMoment(event, train, minutes, moment);
  if (now === null) return false;
  // Sens de marche à l'arrivée (+1: vers la fin de la voie), puis au départ.
  const arriving: 1 | -1 = train.comesFrom === 'start' ? 1 : -1;
  const leaving = train.leavesTo === 'end' ? 1 : -1;
  const travel = now.phase === 'leaving' ? leaving * now.run : -arriving * now.run;
  // Distance de la tête au centre de chaque véhicule, comptée vers la queue.
  let toAligned = 0;
  let behind = 0;
  train.consist.forEach((vehicle, i) => {
    if (i === train.stop.vehicle) toAligned = behind + lead(vehicle);
    behind += vehicle.front + vehicle.back;
  });
  const aligned = project(track, point.x, point.y) + arriving * train.stop.shift;
  const stopHead = aligned + arriving * toAligned;
  const head = stopHead + travel;
  // Emprise sur la voie: la rame d'ici à là où elle va (son arrêt, ou la fin de son départ).
  const goal = now.phase === 'leaving' ? stopHead + leaving * train.departure.distance : stopHead;
  const tailNow = head - arriving * behind;
  const tailGoal = goal - arriving * behind;
  out.reachFrom = Math.min(head, tailNow, goal, tailGoal);
  out.reachTo = Math.max(head, tailNow, goal, tailGoal);
  out.track = train.track;
  out.event = event.id;
  out.phase = now.phase;
  out.moving = now.phase !== 'stopped';
  out.head = head;
  out.vehicles.length = train.consist.length;
  behind = 0;
  train.consist.forEach((vehicle, i) => {
    const center = head - arriving * (behind + lead(vehicle));
    behind += vehicle.front + vehicle.back;
    const pose = (out.vehicles[i] ??= { model: '', x: 0, y: 0, yaw: 0, front: 0, back: 0 });
    pose.model = vehicle.model;
    pose.front = vehicle.front;
    pose.back = vehicle.back;
    poseOnTrack(track, center, arriving, vehicle.reversed === true, pose, settings);
  });
  return true;
}

/** Les événements à train d'un lieu qui ont lieu ce jour-là, conditions réunies. */
export function trainEvents(look: Look, placeId: string, day: number): CalendarEventDef[] {
  return eventsOn(look, placeId, day).filter((event) => event.train !== undefined);
}

/**
 * Les trains présents d'un lieu à l'heure `minutes`, écrits dans `pool` (réutilisé d'un appel à
 * l'autre); rend leur nombre.
 */
export function trainPoses(
  look: Look,
  placeId: string,
  minutes: number,
  pool: TrainPose[],
  events: readonly CalendarEventDef[] = trainEvents(look, placeId, look.world.common.day),
): number {
  const place = look.content.places[placeId];
  if (place === undefined) return 0;
  let count = 0;
  for (const event of events) {
    const out = (pool[count] ??= {
      event: '',
      phase: 'stopped',
      moving: false,
      head: 0,
      track: '',
      reachFrom: 0,
      reachTo: 0,
      vehicles: [],
    });
    if (poseTrain(place, event, minutes, out)) count++;
  }
  return count;
}

/** Trains du lieu à l'heure de l'état, gardés le temps d'un pas (les obstacles les relisent). */
interface Seen {
  world: Look['world'] | null;
  minutes: number;
  day: number;
  count: number;
  readonly pool: TrainPose[];
}
const seen = new WeakMap<PlaceContent, Seen>();

function current(look: Look, place: PlaceContent): Seen {
  let memo = seen.get(place);
  if (memo === undefined) {
    memo = { world: null, minutes: Number.NaN, day: 0, count: 0, pool: [] };
    seen.set(place, memo);
  }
  const { world } = look;
  if (memo.world !== world || memo.minutes !== world.minutes || memo.day !== world.common.day) {
    memo.world = world;
    memo.minutes = world.minutes;
    memo.day = world.common.day;
    memo.count = trainPoses(look, place.def.id, world.minutes, memo.pool);
  }
  return memo;
}

/** Emprise d'un véhicule: rectangle autour de son axe, allongé si la rame roule (`margin`). */
function eachCell(
  pose: VehiclePose,
  margin: number,
  settings: TrainSettings,
  visit: (x: number, y: number) => void,
): void {
  const fx = Math.sin(pose.yaw);
  const fy = Math.cos(pose.yaw);
  const step = settings.sample;
  const half = settings.halfWidth;
  const from = -pose.back - margin;
  const to = pose.front + margin;
  for (let a = from; a <= to + 1e-9; a += step) {
    const along = Math.min(a, to);
    for (let b = -half; b <= half + 1e-9; b += step) {
      const side = Math.min(b, half);
      visit(pose.x + fx * along + fy * side, pose.y + fy * along - fx * side);
    }
  }
}

/** Empreinte des trains du lieu à l'heure de l'état (0: aucun): les obstacles se refont quand elle change. */
export function trainSignature(
  look: Look,
  place: PlaceContent,
  settings: TrainSettings = TRAINS,
): number {
  const memo = current(look, place);
  let h = memo.count;
  for (let i = 0; i < memo.count; i++) {
    const pose = memo.pool[i];
    if (pose === undefined) continue;
    h = (Math.imul(h, 31) + Math.round(pose.head / settings.quantum)) | 0;
    h = (Math.imul(h, 31) + (pose.moving ? 1 : 2)) | 0;
  }
  return h;
}

/** Marque à 1 dans `cells` (grille du lieu) les cases sous les trains présents. */
export function markTrainCells(
  look: Look,
  place: PlaceContent,
  cells: Uint8Array,
  settings: TrainSettings = TRAINS,
): void {
  const { width, height } = place.map;
  const memo = current(look, place);
  for (let i = 0; i < memo.count; i++) {
    const pose = memo.pool[i];
    if (pose === undefined) continue;
    const margin = pose.moving ? settings.movingMargin : 0;
    for (const vehicle of pose.vehicles)
      eachCell(vehicle, margin, settings, (x, y) => {
        const cx = Math.floor(x);
        const cy = Math.floor(y);
        if (cx >= 0 && cy >= 0 && cx < width && cy < height) cells[cy * width + cx] = 1;
      });
  }
}

/** Le disque (x, y, rayon) touche-t-il un train présent du lieu ? */
export function touchesTrain(
  look: Look,
  place: PlaceContent,
  x: number,
  y: number,
  radius: number,
  settings: TrainSettings = TRAINS,
): boolean {
  const memo = current(look, place);
  for (let i = 0; i < memo.count; i++) {
    const pose = memo.pool[i];
    if (pose === undefined) continue;
    const margin = pose.moving ? settings.movingMargin : 0;
    for (const vehicle of pose.vehicles) {
      const fx = Math.sin(vehicle.yaw);
      const fy = Math.cos(vehicle.yaw);
      const dx = x - vehicle.x;
      const dy = y - vehicle.y;
      const along = dx * fx + dy * fy;
      const side = dx * fy - dy * fx;
      if (
        Math.abs(side) < settings.halfWidth + radius &&
        along > -vehicle.back - margin - radius &&
        along < vehicle.front + margin + radius
      )
        return true;
    }
  }
  return false;
}

/**
 * Minutes de jeu avant qu'un train d'événement n'occupe la voie `track` du lieu: 0 s'il y est
 * (arrivée, quai ou départ), l'infini si aucun n'est prévu d'ici la fin du jour. Pur: l'hôte et
 * l'invité lisent la même annonce. Sert aux véhicules de voie des joueurs, qui lui cèdent la voie.
 */
export function minutesToTrain(look: Look, placeId: string, track: string): number {
  const minutes = look.world.minutes;
  let soonest = Number.POSITIVE_INFINITY;
  for (const event of trainEvents(look, placeId, look.world.common.day)) {
    const train = event.train;
    if (train?.track !== track) continue;
    if (trainMoment(event, train, minutes, moment) !== null) return 0;
    const wait = wrap(event.hours.from - train.arrival.minutes - minutes);
    // Au-delà de minuit, c'est le calendrier de demain qui dira s'il vient.
    if (minutes + wait < MINUTES_PER_DAY && wait < soonest) soonest = wait;
  }
  return soonest;
}

/** Un train est-il là (arrivée, quai ou départ) dans ce lieu, à l'heure de l'état ? */
export function trainsPresent(look: Look, place: PlaceContent): boolean {
  return current(look, place).count > 0;
}

// ---- Passages à niveau ----

/** Un passage à niveau: là où une voie à ciel ouvert croise une route de la carte. */
export interface LevelCrossing {
  readonly track: string;
  /** Bords de la route le long de la voie (m depuis son début), et son milieu sur la carte. */
  readonly from: number;
  readonly to: number;
  readonly x: number;
  readonly y: number;
}

const crossingCache = new WeakMap<PlaceContent, readonly LevelCrossing[]>();

/**
 * Passages à niveau du lieu, tirés de la carte: chaque traversée d'une case des natures de
 * `TRAINS.crossing` par une voie à ciel ouvert. Calculés une fois par lieu.
 */
export function levelCrossings(
  place: PlaceContent,
  settings: TrainSettings = TRAINS,
): readonly LevelCrossing[] {
  const known = crossingCache.get(place);
  if (known !== undefined) return known;
  const out: LevelCrossing[] = [];
  const { map } = place;
  const terrain = map.terrain;
  if (terrain !== undefined) {
    const cells = decodeTerrain(map);
    const codes = new Set(
      settings.crossing.natures.map((n) => terrain.legend.indexOf(n)).filter((i) => i >= 0),
    );
    const at = { x: 0, y: 0 };
    for (const rail of map.rails ?? []) {
      if (rail.tunnel === true) continue;
      const track = trackOf(place, rail.id);
      if (track === null || cells === null) continue;
      let start = -1;
      const close = (end: number): void => {
        const mid = (start + end) / 2;
        pointOn(track, mid, at);
        out.push({ track: rail.id, from: start, to: end, x: at.x, y: at.y });
        start = -1;
      };
      const step = settings.crossing.sample;
      for (let s = 0; s <= track.length; s += step) {
        pointOn(track, s, at);
        const cx = Math.floor(at.x);
        const cy = Math.floor(at.y);
        const inside =
          cx >= 0 &&
          cy >= 0 &&
          cx < map.width &&
          cy < map.height &&
          codes.has(cells[cy * map.width + cx] ?? -1);
        if (inside && start < 0) start = s;
        else if (!inside && start >= 0) close(s);
      }
      if (start >= 0) close(track.length);
    }
  }
  crossingCache.set(place, out);
  return out;
}

/** Le passage à niveau est-il fermé (sonnerie, lisses baissées) à l'heure de l'état ? */
export function crossingClosed(
  look: Look,
  place: PlaceContent,
  crossing: LevelCrossing,
  settings: TrainSettings = TRAINS,
): boolean {
  const memo = current(look, place);
  const margin = settings.crossing.margin;
  for (let i = 0; i < memo.count; i++) {
    const pose = memo.pool[i];
    if (pose?.track !== crossing.track) continue;
    if (pose.reachFrom < crossing.to + margin && pose.reachTo > crossing.from - margin) return true;
  }
  return false;
}

/** Un passage à niveau du lieu sonne-t-il à l'heure de l'état ? */
export function crossingBellRinging(
  look: Look,
  place: PlaceContent,
  settings: TrainSettings = TRAINS,
): boolean {
  if (current(look, place).count === 0) return false;
  return levelCrossings(place, settings).some((c) => crossingClosed(look, place, c, settings));
}

// ---- Habitants ----

/**
 * Le disque (x, y, rayon) est-il sur le chemin d'une rame (sa place, et celle où elle va) ? Un
 * habitant n'y entre pas: il attend au bord ou passe ailleurs.
 */
export function inTrainWay(
  look: Look,
  place: PlaceContent,
  x: number,
  y: number,
  radius: number,
  settings: TrainSettings = TRAINS,
  stoppedOnly = false,
): boolean {
  const memo = current(look, place);
  for (let i = 0; i < memo.count; i++) {
    const pose = memo.pool[i];
    if (pose === undefined || (stoppedOnly && pose.moving)) continue;
    const track = trackOf(place, pose.track);
    if (track === null) continue;
    const s = project(track, x, y);
    if (s < pose.reachFrom - radius || s > pose.reachTo + radius) continue;
    pointOn(track, s, front);
    if (Math.hypot(front.x - x, front.y - y) < settings.halfWidth + radius) return true;
  }
  return false;
}

/**
 * Le segment (a, b), parcouru par un corps de rayon `radius`, croise-t-il une rame à quai ? Une
 * rame qui passe ne barre la voie que quelques minutes: on l'attend au bord, sans détour.
 */
export function segmentAcrossStoppedTrain(
  look: Look,
  place: PlaceContent,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  radius: number,
  settings: TrainSettings = TRAINS,
): boolean {
  if (current(look, place).count === 0) return false;
  const length = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(length / settings.waySample));
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    if (inTrainWay(look, place, ax + (bx - ax) * t, ay + (by - ay) * t, radius, settings, true))
      return true;
  }
  return false;
}
