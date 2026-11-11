/**
 * Planning d'un habitant: la ligne en cours selon l'heure, le jour de la semaine, la météo, la
 * saison et l'histoire, et l'endroit exact où elle se tient (point, place assise, meuble). Pur:
 * lit l'état transmis et le contenu, rien d'autre.
 */
import type { Content, PlaceContent } from '../../donnees/charger';
import { SEASONS } from '../../donnees/schemas/prise';
import type { MapObject } from '../../donnees/schemas/lieu';
import type { PropDef } from '../../donnees/schemas/meuble';
import {
  WEEKDAYS,
  type ScheduleEntry,
  type Spot,
  type VillagerLife,
  type Weekday,
} from '../../donnees/schemas/vie-habitant';
import type { ReadonlyWorld } from '../../etat/monde';
import { evaluateAll, type RuleContext } from '../regles/conditions';
import { VILLAGERS } from './reglages';

export type Season = (typeof SEASONS)[number];

/** Jour de la semaine du jour de jeu `day` (le jour 1 est un lundi). */
export function weekdayOf(day: number): Weekday {
  return WEEKDAYS[(((day - 1) % 7) + 7) % 7] ?? 'mon';
}

/** Saison du jour de jeu `day`: `seasonDays` jours chacune, en partant du printemps. */
export function seasonOf(day: number, seasonDays: number): Season {
  return SEASONS[Math.floor((day - 1) / seasonDays) % SEASONS.length] ?? 'spring';
}

/** Minute dans la plage `[from, to)`, qui peut passer minuit. */
export function inRange(minute: number, from: number, to: number): boolean {
  return from <= to ? minute >= from && minute < to : minute >= from || minute < to;
}

/** Ligne sans aucun filtre autre que l'heure: c'est elle qui garantit un planning sans trou. */
export function isUnconditional(entry: ScheduleEntry): boolean {
  return (
    entry.days === undefined &&
    entry.weathers === undefined &&
    entry.seasons === undefined &&
    (entry.when === undefined || entry.when.length === 0)
  );
}

export interface Look {
  readonly content: Content;
  readonly world: ReadonlyWorld;
}

/** La ligne qui s'applique maintenant: la première qui convient, -1 s'il n'y en a aucune. */
export function currentEntry(look: Look, life: VillagerLife): number {
  const { world, content } = look;
  const minute = Math.min(world.minutes, 1439.999);
  const day = weekdayOf(world.common.day);
  const season = seasonOf(world.common.day, content.settings.clock.seasonDays);
  const ctx: RuleContext = { world, content, actor: null };
  for (let i = 0; i < life.schedule.length; i++) {
    const entry = life.schedule[i];
    if (entry === undefined || !inRange(minute, entry.from, entry.to)) continue;
    if (entry.days !== undefined && !entry.days.includes(day)) continue;
    if (entry.weathers !== undefined && !entry.weathers.includes(world.common.weather)) continue;
    if (entry.seasons !== undefined && !entry.seasons.includes(season)) continue;
    if (entry.when !== undefined && !evaluateAll(ctx, entry.when)) continue;
    return i;
  }
  return -1;
}

/** Où se tient le corps pour une ligne, tourné comment, et sur quelle place s'il s'assoit. */
export interface Goal {
  x: number;
  y: number;
  /** Cap une fois arrivé, `null`: garder celui de la marche. */
  facing: number | null;
  /** Place assise ou couchée: on marche jusqu'à (`x`, `y`), devant le meuble, puis on s'y installe. */
  seat: {
    object: string;
    index: number;
    x: number;
    y: number;
    facing: number;
    pose: 'sit' | 'lie';
  } | null;
}

/** Façade d'un meuble: 0 au sud, puis par quarts de tour (même convention que `briques/postures.ts`). */
function front(rotation: number): { x: number; y: number } {
  return {
    x: rotation === 1 ? 1 : rotation === 3 ? -1 : 0,
    y: rotation === 0 ? 1 : rotation === 2 ? -1 : 0,
  };
}

/** Profondeur d'un meuble le long de sa façade: sa hauteur `h` avant rotation. */
function depthOf(def: PropDef): number {
  return def.size.h;
}

export function findObject(place: PlaceContent, id: string): MapObject | null {
  return place.map.objects.find((o) => o.id === id) ?? null;
}

/**
 * Position d'une place assise, calculée comme la brique `sit` installe un joueur: les places se
 * partagent la largeur du meuble, le corps tourné vers sa façade.
 */
export function seatPose(
  object: MapObject,
  def: PropDef,
  seats: number,
  index: number,
): { x: number; y: number; facing: number } {
  const f = front(object.rotation);
  const along = ((index + 0.5) / seats - 0.5) * def.size.w;
  return { x: object.x + f.y * along, y: object.y - f.x * along, facing: Math.atan2(f.y, f.x) };
}

/** Point devant (ou derrière) un meuble, hors de son emprise. */
function besideObject(
  object: MapObject,
  def: PropDef,
  side: 'front' | 'behind',
  fromX: number,
  fromY: number,
): { x: number; y: number; facing: number } {
  const f = front(object.rotation);
  const s = side === 'front' ? 1 : -1;
  const out = depthOf(def) / 2 + VILLAGERS.radius + VILLAGERS.objectGap;
  const x = fromX + f.x * s * out;
  const y = fromY + f.y * s * out;
  // Devant: face au meuble; derrière (comptoir): face à qui vient, dans le sens de la façade.
  return { x, y, facing: side === 'front' ? Math.atan2(-f.y, -f.x) : Math.atan2(f.y, f.x) };
}

/** Le meuble que nomme un poste, `null` pour un point. */
export function spotObject(spot: Spot): string | null {
  if ('seat' in spot) return spot.seat;
  if ('bed' in spot) return spot.bed;
  return 'object' in spot ? spot.object : null;
}

/** Places d'un meuble pour s'y asseoir (brique `sit`) ou s'y coucher (brique `sleep`), 0 sans la brique. */
export function placesOf(def: PropDef, pose: 'sit' | 'lie'): number {
  for (const b of def.bricks) {
    if (pose === 'sit' && b.brick === 'sit') return b.seats;
    if (pose === 'lie' && b.brick === 'sleep') return b.places;
  }
  return 0;
}

/**
 * L'endroit d'une ligne. `seatsTaken(object, index)` dit si une place est déjà prise (joueur ou
 * autre habitant): on prend la première libre, sinon on reste debout devant le siège.
 */
export function goalOf(
  content: Content,
  place: PlaceContent,
  spot: Spot,
  seatTaken: (object: string, index: number) => boolean,
): Goal | null {
  if ('point' in spot) {
    const p = place.map.points[spot.point];
    return p === undefined ? null : { x: p.x, y: p.y, facing: null, seat: null };
  }
  const id = spotObject(spot);
  const object = id === null ? null : findObject(place, id);
  const def = object === null ? undefined : content.props[object.type];
  if (object === null || def === undefined) return null;
  if ('object' in spot) {
    const at = besideObject(object, def, spot.side, object.x, object.y);
    return { x: at.x, y: at.y, facing: at.facing, seat: null };
  }
  const places = placesOf(def, 'bed' in spot ? 'lie' : 'sit');
  if (places === 0) return null;
  let index = 0;
  while (index < places && seatTaken(object.id, index)) index++;
  const chosen = Math.min(index, places - 1);
  const pose = seatPose(object, def, places, chosen);
  const stand = besideObject(object, def, 'front', pose.x, pose.y);
  return {
    x: stand.x,
    y: stand.y,
    facing: pose.facing,
    seat:
      index < places
        ? { object: object.id, index, ...pose, pose: 'bed' in spot ? 'lie' : 'sit' }
        : null,
  };
}
