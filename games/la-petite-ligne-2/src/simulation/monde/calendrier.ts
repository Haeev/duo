/**
 * Calendrier (cahier 4.3): une semaine de 7 jours, des saisons de `clock.seasonDays` jours, une
 * année de 4 saisons. Le jour de jeu va d'une aube à la suivante: après minuit, c'est encore la
 * veille. Fonctions pures, valables chez l'hôte comme chez l'invité.
 */
import type { Content } from '../../donnees/charger';
import { SEASONS, WEEKDAYS, type Season, type Weekday } from '../../donnees/schemas/temps';

export interface CalendarDay {
  /** Année, à partir de 1. */
  readonly year: number;
  readonly season: Season;
  /** Jour de la saison, à partir de 1. */
  readonly dayOfSeason: number;
  readonly weekday: Weekday;
}

/** La date d'un jour de jeu (à partir de 1). */
export function calendarOf(content: Content, day: number): CalendarDay {
  const { seasonDays } = content.settings.clock;
  const { firstSeason, firstWeekday } = content.time.file;
  const index = Math.max(0, day - 1);
  const seasonsElapsed = Math.floor(index / seasonDays) + SEASONS.indexOf(firstSeason);
  return {
    year: Math.floor(seasonsElapsed / SEASONS.length) + 1,
    season: SEASONS[seasonsElapsed % SEASONS.length] ?? 'spring',
    dayOfSeason: (index % seasonDays) + 1,
    weekday: WEEKDAYS[(index + WEEKDAYS.indexOf(firstWeekday)) % WEEKDAYS.length] ?? 'monday',
  };
}

/** Minutes écoulées depuis l'aube du jour de jeu (0 à 1439). */
export function minutesSinceDawn(content: Content, minutes: number): number {
  const dawn = content.settings.clock.dayStart;
  return (((Math.floor(minutes) - dawn) % 1440) + 1440) % 1440;
}

/** Plage d'heures (elle peut passer minuit), `from` inclus, `to` exclu; `from === to`: toute la journée. */
export function inHours(hours: { from: number; to: number }, minutes: number): boolean {
  if (hours.from === hours.to) return true;
  return hours.from < hours.to
    ? minutes >= hours.from && minutes < hours.to
    : minutes >= hours.from || minutes < hours.to;
}
