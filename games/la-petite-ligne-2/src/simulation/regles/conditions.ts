/**
 * Évaluation des conditions des données (dialogues, briques, quêtes au jalon 2). Aucun contenu
 * nommé: chaque cas lit l'état d'après les seuls paramètres de la condition.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { Condition, FactOwner } from '../../donnees/schemas/regles';
import type { ReadonlyWorld } from '../../etat/monde';
import { bondKey, type Fact } from '../../etat/progression';
import { calendarOf } from '../monde/calendrier';
import { choiceOf, decisionState, decisionTaken } from '../quetes/decisions';
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
    case 'money_at_least':
      return forActor(ctx, (p) => world.players[p].money >= condition.amount);
    case 'place_is':
      return world.common.place === condition.place;
    case 'decision_is': {
      const { decision, option } = condition;
      const fits = (chosen: string | null): boolean =>
        chosen !== null && (option === undefined || chosen === option);
      if (condition.state === 'agreed') return fits(decisionTaken(world, decision));
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
  }
}

export function evaluateAll(ctx: RuleContext, conditions: readonly Condition[]): boolean {
  return conditions.every((c) => evaluate(ctx, c));
}
