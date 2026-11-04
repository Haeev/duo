/**
 * Plannings des habitants, lus sans la simulation (0.13, lot H1): calendrier du bourg (jours
 * particuliers, classe, anniversaires) et conditions d'un planning évaluées sur l'état du monde,
 * à un instant donné. Pur: la simulation (conditions nouvelles), le carnet (« maintenant », grille de
 * la semaine) et les tests lisent les mêmes règles.
 */
import { dayOfSeason, seasonOfDay, weekdayOf } from '../donnees/calendrier';
import type { Condition, Content, ScheduleEntry, Since, Who } from '../donnees/types';
import type { SpecialDayDef } from '../donnees/types-voisins';
import { bondLevel, bondOf } from './amitie';
import type { ReadonlyWorld, Weather } from './types';

/** Un instant du calendrier: jour de la partie, minute du jour, temps qu'il fait. */
export interface PlanningMoment {
  day: number;
  minutes: number;
  weather: Weather;
}

export function momentOf(world: ReadonlyWorld): PlanningMoment {
  return { day: world.clock.day, minutes: world.clock.minutes, weather: world.weather };
}

/** Ce jour particulier tombe-t-il ce jour-là ? */
export function specialDayOn(content: Content, d: SpecialDayDef, day: number): boolean {
  const s = content.settings;
  if (d.weekdays.includes(weekdayOf(day))) return true;
  return (d.seasonDays[seasonOfDay(s, day)] ?? []).includes(dayOfSeason(s, day));
}

/** Les jours particuliers de ce jour, dans l'ordre de `calendrier.json`. */
export function specialDaysOn(content: Content, day: number): SpecialDayDef[] {
  return content.villageCalendar.specialDays.filter((d) => specialDayOn(content, d, day));
}

/** Jour de classe: jour de la semaine de classe, hors vacances, hors jour particulier sans classe. */
export function isSchoolDay(content: Content, day: number): boolean {
  const school = content.villageCalendar.school;
  if (!school.weekdays.includes(weekdayOf(day))) return false;
  if (school.holidaySeasons.includes(seasonOfDay(content.settings, day))) return false;
  return !specialDaysOn(content, day).some((d) => d.noSchool);
}

/** Est-ce l'anniversaire de cet habitant ce jour-là (chaque année) ? */
export function isBirthday(content: Content, villager: string, day: number): boolean {
  const b = content.villageCalendar.birthdays[villager];
  return (
    b?.season === seasonOfDay(content.settings, day) && b.day === dayOfSeason(content.settings, day)
  );
}

/** L'habitude est-elle au carnet ? */
export function habitKnown(world: ReadonlyWorld, villager: string, habit: string): boolean {
  return world.habits.known[villager]?.includes(habit) ?? false;
}

function countValue(world: ReadonlyWorld, key: string, who: Who, since: Since): number | null {
  // Seuls les comptes depuis le début de la partie se lisent hors de la simulation.
  if (since !== 'game_start') return null;
  const c = world.counters;
  if (who === 'both') return Math.min(c.p1[key] ?? 0, c.p2[key] ?? 0);
  return c.duo[key] ?? 0;
}

/**
 * Une condition d'un planning à cet instant. Les conditions qui ne se lisent pas sur l'état seul
 * (regard, sac, événement d'outil...) valent `false`: un planning n'en a pas besoin.
 */
export function planningCondition(
  content: Content,
  world: ReadonlyWorld,
  c: Condition,
  at: PlanningMoment,
): boolean {
  const s = content.settings;
  switch (c.type) {
    case 'all':
      return c.conditions.every((x) => planningCondition(content, world, x, at));
    case 'any':
      return c.conditions.some((x) => planningCondition(content, world, x, at));
    case 'not':
      return !planningCondition(content, world, c.condition, at);
    case 'day_is':
      return c.days.includes(at.day);
    case 'day_at_least':
      return at.day >= c.day;
    case 'weekday_is':
      return c.weekdays.includes(weekdayOf(at.day));
    case 'time_is':
      return at.minutes >= c.from && at.minutes < c.to;
    case 'weather_is':
      return at.weather === c.weather;
    case 'season_is':
      return (
        c.seasons.includes(seasonOfDay(s, at.day)) && dayOfSeason(s, at.day) >= c.fromSeasonDay
      );
    case 'flag':
      return world.flags.includes(c.flag);
    case 'quest_active':
      return world.quests.some((q) => q.id === c.quest && q.status === 'active');
    case 'quest_done':
      return world.quests.some((q) => q.id === c.quest && q.status === 'done');
    case 'step_active':
    case 'quest_step_done': {
      const q = world.quests.find((x) => x.id === c.quest);
      const index =
        content.quests.find((x) => x.id === c.quest)?.steps.findIndex((x) => x.id === c.step) ?? -1;
      if (q === undefined || index < 0) return false;
      return c.type === 'step_active'
        ? q.status === 'active' && q.step === index
        : q.status === 'done' || q.step > index;
    }
    case 'built':
      return world.constructions.some((k) => k.id === c.construction && k.status === 'done');
    case 'improvement_built':
      return (world.improvements[c.id]?.builtDay ?? null) !== null;
    case 'counter': {
      const value = countValue(world, c.key, c.who, c.since);
      return value !== null && value >= c.count;
    }
    case 'school_day':
      return isSchoolDay(content, at.day);
    case 'special_day': {
      const d = content.villageCalendar.specialDays.find((x) => x.id === c.id);
      return d !== undefined && specialDayOn(content, d, at.day);
    }
    case 'season_day_is':
      return c.days.includes(dayOfSeason(s, at.day));
    case 'birthday_of':
      return isBirthday(content, c.villager, at.day);
    case 'decision_made':
      return world.decisions[c.decision] === c.option;
    case 'habit_known':
      return habitKnown(world, c.villager, c.habit);
    case 'bond_at_least':
      return bondLevel(content.settings.bonds, bondOf(world, c.villager)) >= c.level;
    case 'weather_was':
    case 'weather_tomorrow_is':
    case 'morning_mist':
    case 'tenderness_at_least':
    case 'stage_due':
    case 'dialogue_done':
    case 'item_owned':
    case 'item_in_bag':
    case 'recipe_known':
    case 'order_complete':
    case 'used_tool_at':
    case 'stayed_at':
    case 'variant':
    case 'looked_at':
    case 'secret_role':
    case 'hens_named':
    case 'choice_made':
    case 'annonce_active':
    case 'bought':
    case 'inside':
    case 'money_at_least':
      return false;
  }
}

/** L'entrée tient-elle à cet instant (heure dans `[from, to[`, toutes ses conditions vraies) ? */
export function entryHolds(
  content: Content,
  world: ReadonlyWorld,
  entry: ScheduleEntry,
  at: PlanningMoment,
): boolean {
  const m = Math.min(at.minutes, 24 * 60 - 1);
  if (m < entry.from || m >= entry.to) return false;
  return entry.when.every((c) => planningCondition(content, world, c, at));
}

/** Conditions du calendrier: elles finiront par tenir un jour (« possible » ne les lit pas). */
const CALENDAR_CONDITIONS: ReadonlySet<Condition['type']> = new Set<Condition['type']>([
  'weekday_is',
  'time_is',
  'weather_is',
  'weather_was',
  'weather_tomorrow_is',
  'morning_mist',
  'season_is',
  'season_day_is',
  'special_day',
  'birthday_of',
  'school_day',
]);

function hasCalendar(c: Condition): boolean {
  if (c.type === 'all' || c.type === 'any') return c.conditions.some(hasCalendar);
  if (c.type === 'not') return hasCalendar(c.condition);
  return CALENDAR_CONDITIONS.has(c.type);
}

/** La condition peut-elle tenir un jour dans l'état présent (le calendrier mis à part) ? */
function possibleCondition(
  content: Content,
  world: ReadonlyWorld,
  c: Condition,
  at: PlanningMoment,
): boolean {
  if (CALENDAR_CONDITIONS.has(c.type)) return true;
  if (c.type === 'all') return c.conditions.every((x) => possibleCondition(content, world, x, at));
  if (c.type === 'any') return c.conditions.some((x) => possibleCondition(content, world, x, at));
  if (c.type === 'not' && hasCalendar(c.condition)) return true;
  return planningCondition(content, world, c, at);
}

/**
 * L'habitude est-elle possible dans l'état présent (section 4.6, décision du manager du
 * 2026-11-03): une de ses entrées tient un jour ou l'autre avec les drapeaux, les quêtes et les
 * décisions d'aujourd'hui. Fausse pour une habitude d'une quête pas encore faite (Lucie pas
 * revenue) et pour une habitude disparue (Berthe ne va plus voir partir les sacs). Le passage à
 * l'étal du marché, sans entrée, est toujours possible.
 */
export function habitPossible(
  content: Content,
  world: ReadonlyWorld,
  villager: string,
  habit: string,
  at: PlanningMoment = momentOf(world),
): boolean {
  const def = content.villagers.find((v) => v.id === villager);
  const h = def?.habits.find((x) => x.id === habit);
  if (def === undefined || h === undefined) return false;
  if (h.kind === 'market') return true;
  // Plages déjà prises, quel que soit le jour, par une entrée d'avant qui tient sans condition de
  // calendrier (Lucie en tournée tant qu'elle n'est pas revenue): rien n'y passe après elle.
  const taken: [number, number][] = [];
  for (const e of def.schedule) {
    if (
      e.habit === habit &&
      e.when.every((c) => possibleCondition(content, world, c, at)) &&
      !covered(taken, e.from, e.to)
    )
      return true;
    if (!e.when.some(hasCalendar) && e.when.every((c) => planningCondition(content, world, c, at)))
      taken.push([e.from, e.to]);
  }
  return false;
}

/** `[from, to[` est-il couvert par ces plages ? */
function covered(ranges: readonly [number, number][], from: number, to: number): boolean {
  let reach = from;
  for (const [a, b] of [...ranges].sort((x, y) => x[0] - y[0])) {
    if (a > reach) break;
    reach = Math.max(reach, b);
    if (reach >= to) return true;
  }
  return reach >= to;
}
