/**
 * Ambiances par heure, météo et lieu (son.md 3.3, `plan.ambienceByTime`),
 * logique pure. Chaque ambiance reçoit un niveau visé (gain linéaire, 0 pour
 * se taire); le moteur y glisse en douceur. La rivière, placée le long du bord
 * sud, est faite de plusieurs sources (`riverSources`).
 */
import type { GameMap, Rect } from '../etat/carte';
import type { Vec2, Weather } from '../etat/types';
import type { AmbienceRule } from './catalogue';
import { distanceToRect } from './espace';
import { dbToGain, type AudioSettings } from './reglages';

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

export interface AmbienceInput {
  minutes: number;
  weather: Weather;
  /** Le personnage local est dans la maisonnette. */
  inHouse: boolean;
  /** Position du personnage local. */
  at: Vec2;
}

/** L'heure `hour` est-elle dans [from, to[ (au-delà de 24 h: le lendemain matin) ? */
export function inHours(hour: number, from: number, to: number): boolean {
  return (hour >= from && hour < to) || (hour + HOURS_PER_DAY >= from && hour + HOURS_PER_DAY < to);
}

/** Ambiances du dehors, qui passent derrière les murs dans la maisonnette (les autres sont celles de l'intérieur). */
export function isOutdoor(rule: AmbienceRule): boolean {
  return rule.rain !== 'indoor';
}

export interface AmbienceZones {
  village: Rect | null;
  wind: Rect | null;
}

export function ambienceZones(map: GameMap, settings: AudioSettings['ambience']): AmbienceZones {
  return { village: map.zones[settings.village.zone] ?? null, wind: map.zones[settings.wind.zone] ?? null };
}

function proximityDb(at: Vec2, zone: Rect | null, farM: number, farDb: number): number {
  if (zone === null || farM <= 0) return 0;
  return farDb * Math.min(1, distanceToRect(at, zone) / farM);
}

/**
 * Niveau visé de chaque ambiance (gain linéaire). `out` est rempli pour toutes
 * les ambiances des règles (0 pour celles qui se taisent).
 */
export function ambienceLevels(
  rules: readonly AmbienceRule[],
  input: AmbienceInput,
  zones: AmbienceZones,
  settings: AudioSettings['ambience'],
  out: Map<string, number>,
): Map<string, number> {
  for (const rule of rules) out.set(rule.ambience, 0);
  const hour = input.minutes / MINUTES_PER_HOUR;
  const rain = input.weather === 'rain';
  for (const rule of rules) {
    let active: boolean;
    if (rule.rain !== null) {
      active = rain && (rule.rain === 'indoor' ? input.inHouse : !input.inHouse);
    } else if (rule.hours !== null) {
      active = inHours(hour, rule.hours[0], rule.hours[1]) && !(rule.silentInRain && rain);
    } else {
      active = true;
    }
    if (!active) continue;
    let db = rule.volumeDb;
    if (rule.ambience === 'village') db += proximityDb(input.at, zones.village, settings.village.farM, settings.village.farDb);
    if (rule.ambience === 'wind') db += proximityDb(input.at, zones.wind, settings.wind.farM, settings.wind.farDb);
    const gain = dbToGain(db);
    out.set(rule.ambience, Math.max(out.get(rule.ambience) ?? 0, gain));
  }
  return out;
}

export interface RiverSource {
  at: Vec2;
  /** Écart de niveau de cette source (le gué plus fort). */
  gainDb: number;
}

/** Sources de la rivière: une au gué, puis tous les `spacingM` vers l'est et l'ouest, le long du bord nord de l'eau. */
export function riverSources(map: GameMap, settings: AudioSettings['ambience']['river']): RiverSource[] {
  const zone = map.zones[settings.zone];
  if (zone === undefined) return [];
  const ford = map.points[settings.fordPoint];
  const y = zone.y + settings.offsetY;
  const anchor = ford?.x ?? zone.x + zone.w / 2;
  const sources: RiverSource[] = [];
  const spacing = Math.max(1, settings.spacingM);
  let first = anchor;
  while (first - spacing >= zone.x) first -= spacing;
  for (let x = first; x <= zone.x + zone.w; x += spacing) {
    const atFord = Math.abs(x - anchor) < spacing / 2;
    sources.push({ at: { x, y: atFord && ford !== undefined ? ford.y : y }, gainDb: atFord ? settings.fordBoostDb : 0 });
  }
  return sources;
}
