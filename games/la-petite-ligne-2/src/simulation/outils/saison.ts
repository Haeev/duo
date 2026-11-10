/** Saison du jour (cahier 4.3: 14 jours par saison, du printemps à l'hiver) et conditions de rareté. */
import type { Settings } from '../../donnees/schemas/reglages';
import { SEASONS } from '../../donnees/schemas/prise';
import type { WEATHERS } from '../../etat/commun';
import type { Look } from '../briques/types';

export type Season = (typeof SEASONS)[number];
export type Weather = (typeof WEATHERS)[number];

/** Saison du jour `day` (1: premier jour du printemps). */
export function seasonOf(clock: Settings['clock'], day: number): Season {
  const index = Math.floor((Math.max(1, day) - 1) / clock.seasonDays) % SEASONS.length;
  return SEASONS[index] ?? 'spring';
}

/** L'heure `minutes` tombe-t-elle dans la plage (qui peut passer minuit) ? */
export function inHours(range: { from: number; to: number } | null, minutes: number): boolean {
  if (range === null) return true;
  if (range.from <= range.to) return minutes >= range.from && minutes < range.to;
  return minutes >= range.from || minutes < range.to;
}

/** Une liste vide veut dire « toutes ». */
export function allows<T>(list: readonly T[], value: T): boolean {
  return list.length === 0 || list.includes(value);
}

/**
 * Il pleut: le potager s'arrose seul aujourd'hui. Une seule source, les météos qui arrosent de
 * `commun/temps.json` (`wateringWeathers`, celles de l'événement `rain_watered` du temps du monde).
 */
export function isRaining(look: Look): boolean {
  return look.content.time.file.wateringWeathers.includes(look.world.common.weather);
}
