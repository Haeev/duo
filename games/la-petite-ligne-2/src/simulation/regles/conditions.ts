/**
 * Évaluation des conditions des données (dialogues, briques, quêtes au jalon 2). Aucun contenu
 * nommé: chaque cas lit l'état d'après les seuls paramètres de la condition.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { Condition, EventIs, FactOwner } from '../../donnees/schemas/regles';
import type { CalendarEventDef } from '../../donnees/schemas/temps';
import type { ReadonlyWorld } from '../../etat/monde';
import { bondKey, type Fact } from '../../etat/progression';
import { calendarOf, eventDayKey, inHours, occursOn } from '../monde/calendrier';
import { choiceOf, decisionState, decisionTaken, previousDecision } from '../quetes/decisions';
import { worstTune } from '../musique/accord';
import { otherPlayer, playerFactKey } from './memoire';

export interface RuleContext {
  readonly world: ReadonlyWorld;
  readonly content: Content;
  /** Joueur qui parle ou agit; `null`: l'un ou l'autre suffit. */
  readonly actor: PlayerIndex | null;
}

/** Exemplaires d'un objet dans la barre et le sac. */
export function countHeld(player: ReadonlyWorld['players'][number], item: string): number {
  let total = 0;
  for (const slots of [player.toolbar, player.bag?.slots ?? []])
    for (const stack of slots) if (stack?.item === item) total += stack.count;
  return total;
}

function forActor(ctx: RuleContext, test: (player: PlayerIndex) => boolean): boolean {
  return ctx.actor === null ? test(0) || test(1) : test(ctx.actor);
}

/**
 * Le fait lu par une condition: la clé telle quelle, ou (`of`) celle de celui qui agit ou de
 * l'autre joueur. Sans joueur qui agit, l'un ou l'autre des deux suffit.
 */
function factTest(
  ctx: RuleContext,
  key: string,
  of: FactOwner | undefined,
  test: (fact: Readonly<Fact>) => boolean,
): boolean {
  const memory = ctx.world.progress.memory;
  const read = (k: string): boolean => {
    const fact = memory[k];
    return fact !== undefined && test(fact);
  };
  if (of === undefined) return read(key);
  return forActor(ctx, (p) => read(playerFactKey(key, of === 'actor' ? p : otherPlayer(p))));
}

export function evaluate(ctx: RuleContext, condition: Condition): boolean {
  const { world } = ctx;
  switch (condition.type) {
    case 'all':
      return condition.conditions.every((c) => evaluate(ctx, c));
    case 'any':
      return condition.conditions.some((c) => evaluate(ctx, c));
    case 'not':
      return !evaluate(ctx, condition.condition);
    case 'remembered':
      return factTest(
        ctx,
        condition.key,
        condition.of,
        (fact) => condition.equals === undefined || fact.v === condition.equals,
      );
    case 'days_since':
      return factTest(ctx, condition.key, condition.of, (fact) => {
        const days = world.common.day - fact.day;
        return (
          (condition.atLeast === undefined || days >= condition.atLeast) &&
          (condition.atMost === undefined || days <= condition.atMost)
        );
      });
    case 'fact_at_least':
      return factTest(
        ctx,
        condition.key,
        condition.of,
        (fact) => typeof fact.v === 'number' && fact.v >= condition.value,
      );
    case 'need_at_least':
      return forActor(ctx, (p) => world.players[p].needs[condition.need] >= condition.value);
    case 'item_in_bag':
      return forActor(ctx, (p) => countHeld(world.players[p], condition.item) >= condition.count);
    case 'instrument_out_of_tune':
      return forActor(ctx, (p) => worstTune(ctx.content, world, p) !== 'just');
    case 'money_at_least':
      return forActor(ctx, (p) => world.players[p].money >= condition.amount);
    case 'place_is':
      return world.common.place === condition.place;
    case 'decision_is': {
      const { decision, option } = condition;
      const fits = (chosen: string | null): boolean =>
        chosen !== null && (option === undefined || chosen === option);
      if (condition.state === 'agreed') return fits(decisionTaken(world, decision));
      if (condition.state === 'last') return fits(previousDecision(world, decision));
      if (condition.state === 'split') return decisionState(world, decision) === 'split';
      const mine = condition.state === 'mine';
      return forActor(ctx, (p) => fits(choiceOf(world, decision, mine ? p : p === 0 ? 1 : 0)));
    }
    case 'bond_at_least':
      return forActor(
        ctx,
        (p) => (world.progress.bonds[bondKey(condition.villager, p)] ?? 0) >= condition.points,
      );
    case 'time_is': {
      const m = world.minutes;
      // Une plage peut passer minuit (22 h à 2 h).
      return condition.from <= condition.to
        ? m >= condition.from && m < condition.to
        : m >= condition.from || m < condition.to;
    }
    case 'weather_is':
      return condition.weathers.includes(world.common.weather);
    case 'season_is':
      return condition.seasons.includes(calendarOf(ctx.content, world.common.day).season);
    case 'weekday_is':
      return condition.weekdays.includes(calendarOf(ctx.content, world.common.day).weekday);
    case 'event_is':
      return eventIs(ctx, condition.events, condition.when);
  }
}

/**
 * Profondeur des conditions d'événement en cours d'évaluation: les conditions d'un événement
 * peuvent citer un autre événement (la veillée s'efface un jour de fête). Le chargement refuse
 * les boucles (`donnees/valider.ts`); cette garde n'est qu'un filet.
 */
let eventDepth = 0;
const MAX_EVENT_DEPTH = 4;

function eventAt(ctx: RuleContext, event: CalendarEventDef, when: EventIs): boolean {
  const { world, content } = ctx;
  const { place, day } = world.common;
  const live = (d: number): boolean =>
    occursOn(content, event, d) && evaluateAll({ world, content, actor: null }, event.conditions);
  const begun = world.progress.memory[eventDayKey(place, event.id)]?.v === day;
  switch (when) {
    case 'begun':
      return begun;
    case 'today':
      return begun || live(day);
    case 'on':
      return inHours(event.hours, world.minutes) && (begun || live(day));
    case 'tomorrow':
      return live(day + 1);
  }
}

/** Un de ces événements du lieu courant en est-il à ce moment ? */
function eventIs(ctx: RuleContext, events: readonly string[], when: EventIs): boolean {
  if (eventDepth >= MAX_EVENT_DEPTH) return false;
  const list = ctx.content.time.events[ctx.world.common.place] ?? [];
  eventDepth += 1;
  try {
    return list.some((event) => events.includes(event.id) && eventAt(ctx, event, when));
  } finally {
    eventDepth -= 1;
  }
}

export function evaluateAll(ctx: RuleContext, conditions: readonly Condition[]): boolean {
  return conditions.every((c) => evaluate(ctx, c));
}
