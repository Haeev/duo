/**
 * Cueillette de la lisière (tour 8, section 5.2): ce qu'un coin vide porte au matin. Pur, tiré par
 * empreinte (`unitDraw`), sans le générateur de la partie: la démo n'en est pas changée.
 */
import { dayOfSeason, seasonOfDay } from '../donnees/calendrier';
import type { ForageItem, ForageSettings, Season, Settings } from '../donnees/types';
import { unitDraw } from './tirage';
import type { Weather } from './types';

export interface ForageDraw {
  item: string;
  count: number;
}

export interface ForageInput {
  seed: number;
  day: number;
  /** Cueillettes que le duo a déjà ramassées (coup de pouce aux jamais cueillies). */
  pickedBefore: ReadonlySet<string>;
  /** Météo de la veille (girolles après la pluie). */
  yesterday: Weather | null;
}

/** Les cueillettes de saison de ce coin, avec leur poids du jour. */
export function forageCandidates(
  forage: ForageSettings,
  point: string,
  season: Season,
  input: Pick<ForageInput, 'pickedBefore' | 'yesterday'>,
  seasonDay: number | null = null,
): { def: ForageItem; weight: number }[] {
  const corner = forage.points.find((p) => p.point === point);
  if (corner === undefined) return [];
  const out: { def: ForageItem; weight: number }[] = [];
  for (const id of corner.items) {
    const def = forage.items.find((i) => i.item === id);
    if (def === undefined || !def.seasons.includes(season) || def.weight <= 0) continue;
    // Plage de jours de saison (tour 9, le sureau): hors de la plage, hors saison.
    if (def.days !== null && seasonDay !== null && (seasonDay < def.days[0] || seasonDay > def.days[1])) continue;
    let weight = def.weight;
    if (!input.pickedBefore.has(id)) weight *= forage.unseenFactor;
    for (const boost of forage.rainBoost) if (boost.item === id && input.yesterday === 'rain') weight *= boost.factor;
    out.push({ def, weight });
  }
  return out;
}

/**
 * Le tirage du matin pour un coin vide (règles 1 et 2), ou `null`: rien de saison, pas de chance,
 * ou avant `forage.fromDay`.
 */
export function drawForage(
  settings: Pick<Settings, 'calendar' | 'forage'>,
  point: string,
  input: ForageInput,
): ForageDraw | null {
  const forage = settings.forage;
  if (forage === null || input.day < forage.fromDay) return null;
  const candidates = forageCandidates(forage, point, seasonOfDay(settings, input.day), input, dayOfSeason(settings, input.day));
  if (candidates.length === 0) return null;
  if (unitDraw(input.seed, `forage:${point}`, input.day) >= forage.spawnChance) return null;
  const total = candidates.reduce((sum, c) => sum + c.weight, 0);
  let roll = unitDraw(input.seed, `forage-item:${point}`, input.day) * total;
  let chosen = candidates[candidates.length - 1];
  for (const c of candidates) {
    roll -= c.weight;
    if (roll < 0) {
      chosen = c;
      break;
    }
  }
  if (chosen === undefined) return null;
  const [lo, hi] = chosen.def.count;
  const u = unitDraw(input.seed, `forage-count:${point}`, input.day);
  return { item: chosen.def.item, count: Math.min(hi, lo + Math.floor(u * (hi - lo + 1))) };
}

/** Une cueillette encore de saison ce jour-là (sinon elle disparaît pendant la nuit, règle 3). */
export function forageInSeason(
  settings: Pick<Settings, 'calendar' | 'forage'>,
  item: string,
  day: number,
): boolean {
  const def = settings.forage?.items.find((i) => i.item === item);
  if (def === undefined) return true;
  if (!def.seasons.includes(seasonOfDay(settings, day))) return false;
  const d = dayOfSeason(settings, day);
  return def.days === null || (d >= def.days[0] && d <= def.days[1]);
}
