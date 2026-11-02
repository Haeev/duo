/**
 * Calendrier de la partie (tour 8, sections 1, 2 et 7): saisons, jours de la semaine, trains,
 * rythme de l'horloge et étapes. Pur (ni DOM ni Three.js): la simulation, l'interface, le rendu
 * et le son lisent les mêmes règles.
 */
import type { ClockPace, Content, Season, Settings, StageDef, StageId } from './types';

/** Saisons dans l'ordre du calendrier (le jour 1 ouvre le printemps de l'année 1). */
export const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];

/** Jour de la semaine: 0 pour samedi (le jour 1 est un samedi, TE-02), comme `textes.weekdays`. */
export function weekdayOf(day: number): number {
  return (((day - 1) % 7) + 7) % 7;
}

/** Rang de la saison d'un jour dans l'année (0: printemps). */
export function seasonIndexOf(settings: Pick<Settings, 'calendar'>, day: number): number {
  const c = settings.calendar;
  return Math.floor((Math.max(1, day) - 1) / c.seasonDays) % c.seasonsPerYear;
}

export function seasonOfDay(settings: Pick<Settings, 'calendar'>, day: number): Season {
  return SEASONS[seasonIndexOf(settings, day) % SEASONS.length] ?? 'spring';
}

/** Jour dans la saison, de 1 à `seasonDays`. */
export function dayOfSeason(settings: Pick<Settings, 'calendar'>, day: number): number {
  return ((Math.max(1, day) - 1) % settings.calendar.seasonDays) + 1;
}

/** Saison qui commence ce jour-là (carte de saison du petit-déjeuner), `null` sinon ou au jour 1. */
export function seasonStartingOn(settings: Pick<Settings, 'calendar'>, day: number): Season | null {
  return day > 1 && dayOfSeason(settings, day) === 1 ? seasonOfDay(settings, day) : null;
}

/** Un train passe-t-il ce jour-là ? Les jours écrits, puis tous les `repeatEveryDays` jours. */
export function isTrainDay(settings: Pick<Settings, 'train'>, day: number): boolean {
  const t = settings.train;
  if (t.days.includes(day)) return true;
  const last = t.days[t.days.length - 1];
  if (last === undefined || t.repeatEveryDays <= 0 || day <= last) return false;
  return (day - last) % t.repeatEveryDays === 0;
}

/** Premier jour de train à partir de `from` (compris), ou `null` s'il n'y en a plus. */
export function nextTrainDay(settings: Pick<Settings, 'train'>, from: number): number | null {
  const t = settings.train;
  const written = t.days.find((d) => d >= from);
  if (written !== undefined) return written;
  const last = t.days[t.days.length - 1];
  if (last === undefined || t.repeatEveryDays <= 0) return null;
  const k = Math.max(1, Math.ceil((from - last) / t.repeatEveryDays));
  return last + k * t.repeatEveryDays;
}

/** Le même contenu à un autre rythme de journée (R14): robots des tests, page de démonstration. */
export function withClockPace(content: Content, pace: ClockPace): Content {
  return { ...content, settings: { ...content.settings, clock: { ...content.settings.clock, pace } } };
}

/** Secondes réelles par minute de jeu ce jour-là (D1, `clock.schedule`), au rythme choisi (R14). */
export function secondsPerGameMinuteOn(settings: Pick<Settings, 'clock'>, day: number): number {
  let value = settings.clock.secondsPerGameMinute;
  for (const step of settings.clock.schedule)
    if (day >= step.fromDay) value = step.secondsPerGameMinute;
  return value * settings.clock.paces[settings.clock.pace];
}

export function stageDef(settings: Pick<Settings, 'stages'>, id: StageId): StageDef | null {
  return settings.stages.find((s) => s.id === id) ?? null;
}

/** L'heure de l'étape est-elle venue ? */
export function stageReached(
  stage: StageDef,
  clock: { readonly day: number; readonly minutes: number },
): boolean {
  return clock.day > stage.day || (clock.day === stage.day && clock.minutes >= stage.time);
}

/**
 * « Rester à la Halte » existe si une journée jouable suit l'étape dans cette version: la limite
 * `clock.lastDay` tombe après l'heure de l'étape (section 1.1, règle 3).
 */
export function stageCanContinue(
  settings: Pick<Settings, 'clock' | 'stages'>,
  id: StageId,
): boolean {
  const stage = stageDef(settings, id);
  if (stage === null) return false;
  const last = settings.clock.lastDay;
  return last.day > stage.day || (last.day === stage.day && last.end > stage.time);
}
