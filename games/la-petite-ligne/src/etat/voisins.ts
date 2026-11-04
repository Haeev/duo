/**
 * Le carnet des voisins, lu sur l'état (0.13, lot H1; modèle pur pour l'onglet « Voisins » du lot
 * H3, conception `v0-13-habitants.md`, sections 4.2 à 4.7). Rien ici ne lit la vraie position
 * d'un habitant: seulement son planning et ce que le duo en sait.
 */
import type { Content, VillagerDef } from '../donnees/types';
import type { HabitDef } from '../donnees/types-voisins';
import { entryHolds, habitKnown, habitPossible, momentOf, type PlanningMoment } from './planning';
import type { ReadonlyWorld } from './types';

/** Une habitude telle que le carnet la connaît. */
export interface HabitView {
  def: HabitDef;
  known: boolean;
  /** Jours où elle a tenu sans être connue (habitant rencontré). */
  daysPossible: number;
  /** Elle attend le rattrapage (`habits.gossipAfterDays` jours): la prochaine réplique qui peut la dire la dit. */
  overdue: boolean;
  /**
   * Elle a sa place au carnet (section 4.5): connue, ou routinière (cases hachurées), ou variante dont
   * la condition a tenu depuis la rencontre; une habitude née d'une quête, seulement connue.
   */
  shown: boolean;
  /** Elle compte dans « Habitudes: n sur N » (section 4.6): connue, ou possible aujourd'hui. */
  counted: boolean;
  /** Connue mais plus possible (une quête ou une décision l'a fait disparaître): barrée au carnet (4.5). */
  gone: boolean;
}

function villagerOf(content: Content, villager: string): VillagerDef | undefined {
  return content.villagers.find((v) => v.id === villager);
}

/** Les habitudes d'un habitant, dans l'ordre des données. */
export function habitViews(content: Content, world: ReadonlyWorld, villager: string): HabitView[] {
  const def = villagerOf(content, villager);
  if (def === undefined) return [];
  const pending = world.habits.pending[villager] ?? {};
  const after = content.settings.habits.gossipAfterDays;
  return def.habits.map((h) => {
    const known = habitKnown(world, villager, h.id);
    const days = pending[h.id]?.[0] ?? 0;
    const always = h.kind === 'routine' || h.kind === 'home';
    const possible = habitPossible(content, world, villager, h.id);
    return {
      def: h,
      known,
      daysPossible: days,
      overdue: !known && possible && days >= after,
      shown: known || (possible && h.kind !== 'after_quest' && (always || days > 0)),
      counted: known || possible,
      gone: known && !possible,
    };
  });
}

/** « Habitudes: n sur N » d'un habitant (sans les habitudes des quêtes pas encore faites). */
export function habitCount(
  content: Content,
  world: ReadonlyWorld,
  villager: string,
): { known: number; total: number } {
  const views = habitViews(content, world, villager).filter((h) => h.counted);
  return { known: views.filter((h) => h.known).length, total: views.length };
}

/** « Le bourg: n habitudes sur N ». */
export function townHabitCount(
  content: Content,
  world: ReadonlyWorld,
): { known: number; total: number } {
  let known = 0;
  let total = 0;
  for (const v of content.villagers) {
    const c = habitCount(content, world, v.id);
    known += c.known;
    total += c.total;
  }
  return { known, total };
}

/** Où il est sans doute (section 4.7): une habitude connue et son point, ou rien. */
export type Whereabouts =
  { kind: 'likely'; habit: HabitDef; point: string; activity: string } | { kind: 'unknown' };

/**
 * « Maintenant: sans doute à… » (section 4.7): la première entrée du planning qui tient à cet
 * instant parmi celles des habitudes connues. Elle ne lit jamais la position de l'habitant et peut
 * se tromper sur une variante encore inconnue (d'où « sans doute »).
 */
export function likelyWhereabouts(
  content: Content,
  world: ReadonlyWorld,
  villager: string,
  at: PlanningMoment = momentOf(world),
): Whereabouts {
  const def = villagerOf(content, villager);
  if (def === undefined) return { kind: 'unknown' };
  for (const entry of def.schedule) {
    if (entry.habit === null || !habitKnown(world, villager, entry.habit)) continue;
    if (!entryHolds(content, world, entry, at)) continue;
    const habit = def.habits.find((h) => h.id === entry.habit);
    if (habit !== undefined)
      return { kind: 'likely', habit, point: entry.point, activity: entry.activity };
  }
  return { kind: 'unknown' };
}

/** L'habitude de son vrai planning à cet instant (la première entrée qui tient), ou `null`. */
export function habitAt(
  content: Content,
  world: ReadonlyWorld,
  villager: string,
  at: PlanningMoment,
): string | null {
  const def = villagerOf(content, villager);
  const entry = def?.schedule.find((e) => entryHolds(content, world, e, at));
  return entry?.habit ?? null;
}

/**
 * Les habitudes de son vrai planning pendant `[from, to[` ce jour-là, par ce temps, avec leurs
 * minutes, la plus longue d'abord (une case de la grille de la semaine: la plus longue en grand,
 * l'autre en petit, section 4.2). À l'interface d'en cacher le lieu tant qu'elles sont inconnues.
 */
export function habitsDuring(
  content: Content,
  world: ReadonlyWorld,
  villager: string,
  slot: { day: number; from: number; to: number; weather: PlanningMoment['weather'] },
  stepMinutes = 10,
): { habit: string; known: boolean; minutes: number }[] {
  const minutes = new Map<string, number>();
  for (let m = slot.from; m < slot.to; m += stepMinutes) {
    const habit = habitAt(content, world, villager, {
      day: slot.day,
      minutes: m,
      weather: slot.weather,
    });
    if (habit !== null)
      minutes.set(habit, (minutes.get(habit) ?? 0) + Math.min(stepMinutes, slot.to - m));
  }
  return [...minutes.entries()]
    .map(([habit, n]) => ({ habit, known: habitKnown(world, villager, habit), minutes: n }))
    .sort((a, b) => b.minutes - a.minutes);
}
